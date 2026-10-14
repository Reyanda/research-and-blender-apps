import AppKit
import WebKit
import Foundation
import Darwin

final class Host: NSObject, NSApplicationDelegate, WKNavigationDelegate, WKUIDelegate, WKDownloadDelegate {
    var process: Process?
    var window: NSWindow?
    var base: URL!
    let instance = UUID().uuidString
    let testing = CommandLine.arguments.contains("--self-test")
    let uiTesting = CommandLine.arguments.contains("--ui-self-test")
    var web: WKWebView?
    var uiBaseline = 0
    var downloads: [ObjectIdentifier: URL] = [:]
    var testDownloadDirectory: URL?
    func stop() {
        if let p = process, p.isRunning {
            p.terminate()
            let deadline = Date().addingTimeInterval(8)
            while p.isRunning && Date() < deadline { usleep(50_000) }
            if p.isRunning { _ = Darwin.kill(p.processIdentifier, SIGKILL) }
            p.waitUntilExit()
        }
        process = nil
        if let directory = testDownloadDirectory { try? FileManager.default.removeItem(at: directory); testDownloadDirectory = nil }

    }
    func fail(_ message: String) -> Never {
        stop(); fputs(message + "\n", stderr)
        if !testing && !uiTesting { let alert = NSAlert(); alert.messageText = "Unable to start OpenScience"; alert.informativeText = message; alert.runModal() }
        exit(1)
    }
    func applicationDidFinishLaunching(_ notification: Notification) {
        let fd = socket(AF_INET, SOCK_STREAM, 0)
        guard fd >= 0 else { fail("Cannot allocate a local port.") }
        var address = sockaddr_in(); address.sin_len = UInt8(MemoryLayout<sockaddr_in>.size); address.sin_family = sa_family_t(AF_INET); address.sin_addr.s_addr = inet_addr("127.0.0.1")
        let result = withUnsafePointer(to: &address) { $0.withMemoryRebound(to: sockaddr.self, capacity: 1) { Darwin.bind(fd, $0, socklen_t(MemoryLayout<sockaddr_in>.size)) } }
        guard result == 0 else { close(fd); fail("Cannot bind a local port.") }
        var size = socklen_t(MemoryLayout<sockaddr_in>.size)
        _ = withUnsafeMutablePointer(to: &address) { $0.withMemoryRebound(to: sockaddr.self, capacity: 1) { getsockname(fd, $0, &size) } }
        let port = Int(UInt16(bigEndian: address.sin_port)); close(fd)
        base = URL(string: "http://127.0.0.1:\(port)")!
        guard let resources = Bundle.main.resourceURL, let configured = Bundle.main.object(forInfoDictionaryKey: "OpenSciencePython") as? String else { fail("Missing resources. Rebuild the app.") }
        let python = ProcessInfo.processInfo.environment["OPENSCIENCE_PYTHON"] ?? configured
        guard python.hasPrefix("/"), FileManager.default.isExecutableFile(atPath: python) else { fail("Python runtime missing at \(python). Set OPENSCIENCE_PYTHON to an absolute executable path or rebuild.") }
        let p = Process(); p.executableURL = URL(fileURLWithPath: python); p.arguments = [resources.appendingPathComponent("desktop/server.py").path]; p.currentDirectoryURL = resources
        var env = ProcessInfo.processInfo.environment; env["OPENSCIENCE_PORT"] = String(port); env["OPENSCIENCE_HOST"] = "127.0.0.1"; env["OPENSCIENCE_ALLOW_EXECUTION"] = CommandLine.arguments.contains("--allow-execution") ? "1" : "0"
        env["OPENSCIENCE_INSTANCE"] = instance
        env["PYTHONDONTWRITEBYTECODE"] = "1"
        p.environment = env
        do { try p.run(); process = p } catch { fail("Cannot launch backend: \(error)") }
        DispatchQueue.global().async { self.ready() }
    }
    func fetch(_ path: String) -> (Int, String)? {
        let semaphore = DispatchSemaphore(value: 0); var result: (Int, String)?
        var request = URLRequest(url: base.appendingPathComponent(path)); request.timeoutInterval = 2
        URLSession.shared.dataTask(with: request) { data, response, _ in
            if let response = response as? HTTPURLResponse, let data = data { result = (response.statusCode, String(decoding: data, as: UTF8.self)) }; semaphore.signal()
        }.resume()
        semaphore.wait(); return result
    }
    func ready() {
        for _ in 0..<100 {
            if process?.isRunning != true { DispatchQueue.main.async { self.fail("Backend exited. Check Python dependencies; launch from Terminal for the backend error.") }; return }
            if let health = fetch("health"), health.0 == 200, health.1.contains(instance) {
                guard let page = fetch(""), page.0 == 200, page.1.contains("<title>") else { DispatchQueue.main.async { self.fail("Application HTML unavailable.") }; return }
                DispatchQueue.main.async {
                    if self.testing { self.stop(); guard self.fetch("health") == nil else { self.fail("Owned backend still responds after shutdown.") }; print("Native self-test passed: backend ready, HTML loaded, owned backend stopped."); exit(0) }
                    let view = WKWebView(); view.navigationDelegate = self; view.uiDelegate = self; self.web = view
                    self.window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 1100, height: 760), styleMask: [.titled, .closable, .miniaturizable, .resizable], backing: .buffered, defer: false)
                    self.window!.title = "OpenScience"; self.window!.contentView = view; self.window!.center()
                    if self.uiTesting { self.window!.orderFront(nil) }
                    if !self.uiTesting { self.window!.makeKeyAndOrderFront(nil); NSApp.activate(ignoringOtherApps: true) }
                    view.load(URLRequest(url: self.base))
                }; return
            }
            Thread.sleep(forTimeInterval: 0.25)
        }
        DispatchQueue.main.async { self.fail("Backend readiness timed out. Check dependencies and port availability.") }
    }
    func waitUI(_ expression: String, attempts: Int = 120, then: @escaping () -> Void) {
        web!.evaluateJavaScript(expression) { result, error in
            if let error = error { self.fail("WebKit UI script failed: \(error)") }
            if (result as? Bool) == true { then(); return }
            if attempts <= 0 { self.fail("WebKit UI condition timed out: \(expression)") }
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.25) { self.waitUI(expression, attempts: attempts - 1, then: then) }
        }
    }
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        guard uiTesting else { return }
        webView.evaluateJavaScript("api('/api/projects', {method: 'POST', body: {name: 'Desktop integration'}}).then(project => selectProject(project.id)); null") { _, error in
            if let error = error { self.fail("Research project creation failed: \(error)") }
            self.waitUI("document.getElementById('title').textContent === 'Desktop integration' && document.getElementById('inputArea').style.display === 'block'") { self.testResearch(webView) }
        }
    }
    func testResearch(_ webView: WKWebView) {
        let codeTest = ProcessInfo.processInfo.environment["OPENSCIENCE_UI_CODE_TEST"] == "1" ? """
          await api('/api/runtime/python',{method:'PUT',body:{enabled:true,docker_context:'colima'}});
          await showView('conversation'); byId('cellCode').value='x=40'; await runCell();
          byId('cellCode').value='print(x+2)'; await runCell();
          if (!byId('executions').textContent.includes('42')) throw new Error('Persistent Python cell failed');
          byId('cellLanguage').value='r'; byId('cellCode').value='x <- 40'; await runCell();
          byId('cellCode').value='print(x+2)'; await runCell();
          if (!byId('executions').textContent.includes('[1] 42')) throw new Error('Persistent R cell failed');
          await api('/api/runtime/python',{method:'PUT',body:{enabled:false,docker_context:'colima'}});
        """ : ""
        let script = """
        (async () => {
          await showView('files');
          await uploadFile(new File(['Source evidence.'], 'source.txt', {type:'text/plain'}));
          if (!byId('artifactText').value.includes('Source evidence.')) throw new Error('Uploaded text unavailable');
          byId('artifactText').value='Revised evidence.'; await saveVersion();
          if (byId('versionSelect').options.length !== 2) throw new Error('Version history lost');
          byId('annotationText').value='Source annotation'; await addAnnotation();
          if (!byId('annotations').textContent.includes('Source annotation')) throw new Error('Annotation lost');
          await uploadFile(new File([['value','2','4','6'].join(String.fromCharCode(10))], 'measurements.csv', {type:'text/csv'}));
          if (!byId('scientificPreview').textContent.includes('value')) throw new Error('CSV table preview missing');
          await uploadFile(new File([['>sequence-a','AC-T','>sequence-b','ACGT'].join(String.fromCharCode(10))], 'sequences.fasta', {type:'text/plain'}));
          if (!byId('scientificPreview').textContent.includes('AC-T')) throw new Error('Sequence preview missing');
          await uploadFile(new File(['# Source record'+String.fromCharCode(10)+'**Supported finding**'], 'record.md', {type:'text/markdown'}));
          if (!byId('scientificPreview').querySelector('strong')) throw new Error('Markdown preview missing');
          await uploadFile(new File(['# Equation'+String.fromCharCode(10)+'$\\\\frac{1}{2}$'], 'equation.md', {type:'text/markdown'}));
          if (!byId('scientificPreview').querySelector('math mfrac')) throw new Error('Math preview missing');
          await uploadFile(new File(['chr1\t10\t20\tfeature'], 'intervals.bed', {type:'text/plain'}));
          if (!byId('scientificPreview').textContent.includes('feature')) throw new Error('Genomic interval preview missing');
          const molecule = await api('/api/projects/'+currentProject+'/chemistry/sketch',{method:'POST',body:{smiles:'CCO',filename:'ethanol.svg'}});
          if (molecule.preview.atom_count!==3 || molecule.preview.bond_count!==2) throw new Error('Molecular topology incorrect');
          await loadFiles();await openArtifact(molecule.artifact.id);
          if (byId('artifactImage').style.display==='none') throw new Error('Molecular drawing not visible');

          await showView('notes'); byId('noteContent').value='Research observation'; await saveNote();
          if (!byId('notesList').textContent.includes('Research observation')) throw new Error('Note lost');
          await showView('context'); byId('projectContext').value='Project context'; await saveContext();
          byId('memoryContent').value='Reusable research fact'; await saveMemory();
          if (!byId('memoryList').textContent.includes('Reusable research fact')) throw new Error('Memory lost');
          await showView('tools'); byId('toolSelect').value='create_visualization'; renderToolForm();
          byId('arg_data').value='[2,4,6]'; byId('arg_chart_type').value='bar'; byId('arg_title').value='Observed values'; await runScienceTool();
          await showView('files'); if (artifacts.length < 3 || !artifacts.some(a => a.content_type === 'image/png')) throw new Error('Tool image not saved');
          await showView('conversation'); byId('input').value='Summarize the source'; await send();
          if (!activeFrame || !byId('chat').textContent.includes('Integration response')) throw new Error('Session conversation failed');
          byId('planMode').checked=true; byId('input').value='Plan an analysis'; await send();
          if (byId('planPanel').hidden) throw new Error('Plan approval gate missing');
          await approvePlan(); if (!byId('planPanel').hidden) throw new Error('Approved plan did not finish');
          await showSettings(); byId('skillName').value='source-reading'; byId('skillContent').value='Keep source identifiers beside research findings.'; await saveSkill();
          byId('agentName').value='Research reviewer'; byId('agentPrompt').value='Check source coverage.'; byId('agentSkills').value='source-reading'; await saveAgent();
          if (!agents.some(a => a.name === 'Research reviewer')) throw new Error('Authored agent missing');
          await selectProject(currentProject); byId('agentSelect').value=agents.find(a => a.name === 'Research reviewer').id; byId('planMode').checked=false; byId('input').value='Review sources'; await send();
          \(codeTest)
          downloadNotebook();
          await new Promise((resolve,reject) => { let attempts=0; const timer=setInterval(()=>{if(window.notebookDownloadVerified){clearInterval(timer);resolve();}else if(++attempts>100){clearInterval(timer);reject(new Error('Native notebook download failed'));}},100); });
          await showView('review'); await auditSession(false);
          if (!byId('reviewStatus').textContent.includes('findings')) throw new Error('Research review unavailable');
          await showView('files'); await openArtifact(artifacts.find(a => a.content_type === 'image/png').id);
          await new Promise((resolve,reject) => { const image=byId('artifactImage'); if(image.complete && image.naturalWidth)resolve();else{image.onload=resolve;image.onerror=()=>reject(new Error('Research chart failed to render'));} });
          await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))); window.researchUITestDone=true;
        })().catch(error => { byId('workspaceError').textContent=error.message; window.researchUITestError=error.message; }); null
        """
        webView.evaluateJavaScript(script) { _, error in
            if let error = error { self.fail("Research workspace script failed: \(error)") }
            self.waitUI("window.researchUITestDone === true || typeof window.researchUITestError === 'string'") {
                webView.evaluateJavaScript("window.researchUITestError || null") { result, _ in
                    if let error = result as? String { self.fail("Research workspace integration failed: \(error)") }
                    if let destination = ProcessInfo.processInfo.environment["OPENSCIENCE_SCIENCE_SNAPSHOT"] {
                        let config = WKSnapshotConfiguration(); config.afterScreenUpdates = true
                        webView.takeSnapshot(with: config) { image, _ in
                            guard let tiff = image?.tiffRepresentation, let bitmap = NSBitmapImageRep(data: tiff), let png = bitmap.representation(using: .png, properties: [:]) else { self.fail("Research workspace snapshot failed") }
                            do { try png.write(to: URL(fileURLWithPath: destination)) } catch { self.fail("Research snapshot save failed: \(error)") }
                            self.testScene(webView)
                        }
                    } else { self.testScene(webView) }
                }
            }
        }
    }
    func webView(_ webView: WKWebView, runJavaScriptTextInputPanelWithPrompt prompt: String, defaultText: String?, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (String?) -> Void) {
        let alert = NSAlert(); alert.messageText = prompt; alert.addButton(withTitle: "OK"); alert.addButton(withTitle: "Cancel")
        let input = NSTextField(string: defaultText ?? ""); input.frame = NSRect(x: 0, y: 0, width: 320, height: 24); alert.accessoryView = input
        completionHandler(alert.runModal() == .alertFirstButtonReturn ? input.stringValue : nil)
    }
    func webView(_ webView: WKWebView, runOpenPanelWith parameters: WKOpenPanelParameters, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping ([URL]?) -> Void) {
        let panel = NSOpenPanel(); panel.allowsMultipleSelection = parameters.allowsMultipleSelection; panel.canChooseDirectories = parameters.allowsDirectories; panel.canChooseFiles = true
        panel.begin { result in completionHandler(result == .OK ? panel.urls : nil) }
    }
    func testScene(_ webView: WKWebView) {
        waitUI("document.getElementById('blenderNav').style.display === 'block'") {
            webView.evaluateJavaScript("showBlender(); null") { _, error in
                if let error = error { self.fail("Scene view failed: \(error)") }
                self.waitUI("document.querySelectorAll('#sceneObjects tr').length > 0") {
                    webView.evaluateJavaScript("document.querySelectorAll('#sceneObjects tr').length") { result, _ in
                        self.uiBaseline = result as? Int ?? 0
                        webView.evaluateJavaScript("createBlenderCube(); null") { _, _ in
                            self.waitUI("document.getElementById('blenderStatus').textContent.includes('disabled')") {
                        webView.evaluateJavaScript("document.getElementById('allowBlenderCode').checked = true; setBlenderPermission(); null") { _, _ in
                            self.waitUI("document.getElementById('createCubeBtn').disabled === false") {
                                webView.evaluateJavaScript("document.getElementById('createCubeBtn').click(); null") { _, _ in
                                    self.waitUI("document.querySelectorAll('#sceneObjects tr').length === \(self.uiBaseline + 1)") {
                                        webView.evaluateJavaScript("Array.from(document.querySelectorAll('#sceneObjects tr')).find(row => row.textContent.includes('Cube.001')).querySelector('button').click(); null") { _, _ in
                                            self.waitUI("document.getElementById('blenderDetails').textContent.includes('8 vertices')") { self.snapshotUI() }
                                        }
                                    }
                                }
                            }
                        }
                            }
                        }
                    }
                }
            }
        }
    }
    func snapshotUI() {
        let config = WKSnapshotConfiguration(); config.rect = NSRect(x: 0, y: 0, width: 1100, height: 760)
        web!.takeSnapshot(with: config) { image, error in
            guard let image = image, let tiff = image.tiffRepresentation,
                  let bitmap = NSBitmapImageRep(data: tiff), let png = bitmap.representation(using: .png, properties: [:]) else { self.fail("WebKit snapshot failed: \(String(describing: error))") }
            if let destination = ProcessInfo.processInfo.environment["OPENSCIENCE_UI_SNAPSHOT"] {
                do { try png.write(to: URL(fileURLWithPath: destination)) } catch { self.fail("Snapshot save failed: \(error)") }
            }
            self.stop(); print("Native UI test passed: research sessions, versioned files, annotations, notes, memory, chart artifacts, plan approval, agents and skills; Blender scene and permission controls."); exit(0)
        }
    }
    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = action.request.url else { decisionHandler(.cancel); return }
        if url.scheme == base.scheme && url.host == base.host && url.port == base.port { decisionHandler(action.shouldPerformDownload ? .download : .allow); return }
        if action.navigationType == .linkActivated && ["http", "https"].contains(url.scheme ?? "") { NSWorkspace.shared.open(url) }
        decisionHandler(.cancel)
    }
    func webView(_ webView: WKWebView, decidePolicyFor response: WKNavigationResponse, decisionHandler: @escaping (WKNavigationResponsePolicy) -> Void) {
        let disposition = (response.response as? HTTPURLResponse)?.value(forHTTPHeaderField: "Content-Disposition") ?? ""
        decisionHandler(disposition.lowercased().hasPrefix("attachment") ? .download : .allow)
    }
    func webView(_ webView: WKWebView, navigationAction: WKNavigationAction, didBecome download: WKDownload) { download.delegate = self }
    func webView(_ webView: WKWebView, navigationResponse: WKNavigationResponse, didBecome download: WKDownload) { download.delegate = self }
    func download(_ download: WKDownload, decideDestinationUsing response: URLResponse, suggestedFilename: String, completionHandler: @escaping (URL?) -> Void) {
        if uiTesting {
            if testDownloadDirectory == nil {
                let directory = FileManager.default.temporaryDirectory.appendingPathComponent("openscience-download-" + UUID().uuidString)
                do { try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true); testDownloadDirectory = directory } catch { fail("Cannot create disposable download destination") }
            }
            let destination = testDownloadDirectory!.appendingPathComponent((suggestedFilename as NSString).lastPathComponent)
            downloads[ObjectIdentifier(download)] = destination; completionHandler(destination); return
        }
        let panel = NSSavePanel(); panel.nameFieldStringValue = (suggestedFilename as NSString).lastPathComponent
        panel.begin { result in
            if result == .OK, let destination = panel.url { self.downloads[ObjectIdentifier(download)] = destination; completionHandler(destination) }
            else { completionHandler(nil) }
        }
    }
    func downloadDidFinish(_ download: WKDownload) {
        guard let destination = downloads.removeValue(forKey: ObjectIdentifier(download)) else { return }
        if uiTesting {
            guard let data = try? Data(contentsOf: destination), let notebook = try? JSONSerialization.jsonObject(with: data) as? [String: Any], notebook["nbformat"] as? Int == 4 else { fail("Downloaded notebook bytes are invalid") }
            web?.evaluateJavaScript("window.notebookDownloadVerified=true; null")
        }
    }
    func download(_ download: WKDownload, didFailWithError error: Error, resumeData: Data?) {
        downloads.removeValue(forKey: ObjectIdentifier(download))
        if uiTesting { fail("Native download failed: \(error)") }
        else { let alert = NSAlert(); alert.messageText = "Download failed"; alert.informativeText = error.localizedDescription; alert.runModal() }
    }
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }
    func applicationWillTerminate(_ notification: Notification) { stop() }
}
let app = NSApplication.shared; let host = Host(); app.delegate = host
app.setActivationPolicy(CommandLine.arguments.contains("--self-test") || CommandLine.arguments.contains("--ui-self-test") ? .prohibited : .regular)
app.run()
