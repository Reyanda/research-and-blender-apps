import AppKit
import WebKit
import Foundation
import Darwin

final class Host: NSObject, NSApplicationDelegate, WKNavigationDelegate {
    var process: Process?
    var window: NSWindow?
    var base: URL!
    let instance = UUID().uuidString
    let testing = CommandLine.arguments.contains("--self-test")
    let uiTesting = CommandLine.arguments.contains("--ui-self-test")
    var web: WKWebView?
    var uiBaseline = 0
    func stop() {
        if let p = process, p.isRunning {
            p.terminate()
            let deadline = Date().addingTimeInterval(8)
            while p.isRunning && Date() < deadline { usleep(50_000) }
            if p.isRunning { _ = Darwin.kill(p.processIdentifier, SIGKILL) }
            p.waitUntilExit()
        }
        process = nil
    }
    func fail(_ message: String) -> Never {
        stop(); fputs(message + "\n", stderr)
        if !testing && !uiTesting { let alert = NSAlert(); alert.messageText = "Unable to start Research and Blender"; alert.informativeText = message; alert.runModal() }
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
                    let view = WKWebView(); view.navigationDelegate = self; self.web = view
                    self.window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 1100, height: 760), styleMask: [.titled, .closable, .miniaturizable, .resizable], backing: .buffered, defer: false)
                    self.window!.title = "Research and Blender"; self.window!.contentView = view; self.window!.center()
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
            self.waitUI("document.getElementById('title').textContent === 'Desktop integration' && document.getElementById('inputArea').style.display === 'block'") { self.testScene(webView) }
        }
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
            self.stop(); print("Native UI test passed: research project, scene view, visible permission denial, explicit opt-in, Blender cube creation and mesh inspection."); exit(0)
        }
    }
    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = action.request.url else { decisionHandler(.cancel); return }
        if url.scheme == base.scheme && url.host == base.host && url.port == base.port { decisionHandler(.allow); return }
        if action.navigationType == .linkActivated && ["http", "https"].contains(url.scheme ?? "") { NSWorkspace.shared.open(url) }
        decisionHandler(.cancel)
    }
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }
    func applicationWillTerminate(_ notification: Notification) { stop() }
}
let app = NSApplication.shared; let host = Host(); app.delegate = host
app.setActivationPolicy(CommandLine.arguments.contains("--self-test") || CommandLine.arguments.contains("--ui-self-test") ? .prohibited : .regular)
app.run()
