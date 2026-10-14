# OpenScience research workspace

A public reimplementation of research workflows observed in the retained Claude Science source. Projects contain independent sessions, source files, versioned results, notes and execution records. The interface uses a plain navigation column, transcript and file editor.

## Run

Requires Python 3.11 or newer.

```sh
python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
python3 run.py
```

Open http://127.0.0.1:8000. Configure your Chat Completions endpoint and model under Models, agents & execution, or set DEEPSEEK_API_KEY and DEEPSEEK_BASE_URL before starting. Compatible model services receive conversation prompts and reference material; configured database and MCP services receive tool requests.

The listener defaults to loopback. This is a single-user application without multi-user authentication. Restrict access when deploying it on another machine. HOST, PORT and OPENSCIENCE_DATA_DIR select the listener and storage. Existing project messages are retained when the first independent session is created.

## Research workflows

| Workflow | Implementation |
|---|---|
| Projects and sessions | Independent histories, selected models, rename, conversation branches and cancellation and resume |
| Plan approval | Generate a plan without executing tools; edit and approve before running |
| Sources and outputs | Upload files, edit text into new versions, retain prior bytes, group into folders, download and export |
| Scientific previews | CSV tables, FASTA sequences with gap positions, rotatable PDB and mmCIF coordinates, RDKit molecular structures, genomic intervals, PDF, Markdown equations and images |
| Notes and annotations | Searchable project notes and comments attached to individual artifact versions |
| Context and memory | Explicit project context and individually enabled memories accompany conversations |
| Analysis cells | Persistent Python and R namespaces, execution history, saved output files and Python/R notebook export |
| Scientific tools | Direct database, visualization and biological-service requests with retained arguments and results |
| Agents and skills | Authored prompts, editable skills, connector allowlists and excluded tools enforced at execution |
| MCP connections | Real HTTP or local-program transports, tool discovery, explicit grants and project result artifacts |
| Remote compute | SSH scripts, Slurm submissions and Modal Python sandboxes require approval; SSH host keys are verified |
| Reviewer | Inspect stored bytes and generation records; optionally request model commentary against the execution trace |

The workflow specification comes from recovered routes in sm_1503, sm_1505, sm_1507, sm_1508, sm_1509, sm_1513, sm_1519, sm_1520, sm_1521, sm_1526, sm_1530, sm_1537, sm_1539 and sm_1543 under the repository's retained source directory. The replacement uses project-scoped artifact and note routes and JSON/base64 uploads. It does not reproduce the original wire protocol exactly.

[Anthropic's product description](https://claude.com/product/claude-science) and [official documentation](https://claude.com/docs/claude-science/overview) provide the official baseline. The inspected macOS release was 0.1.62, with an Anthropic PBC signature. REA inspected its launcher, bundled executable and app inventory. The running official app's signed-in workflows have not been compared through signed-in workflows. This release does not claim complete parity or provide Anthropic subscription authentication or every original scientific renderer.

## Python and R environments

Install and start Docker, then build the analysis image:

```sh
docker build --target analysis -t openscience-python .
```

On a Mac using Colima, start Colima and use docker --context colima for the build. Select colima in the application's Docker-context field. Enable Allow analysis code execution under research settings before running cells.

Kernels run as an unprivileged container user without network access, with a read-only root, memory, CPU and process limits and bounded temporary output storage. Variables persist within a session and language. Restart clears that namespace. Revoking permission or closing the daemon stops its owned kernels.

Current project files are snapshotted read-only into /inputs. Write generated files into /outputs to retain them as versioned project artifacts. Python and R outputs record the submitted code, input identities, execution ID and immutable Docker image ID. The project export includes saved sessions, execution records and all artifact versions. Export a notebook from a session to retain cells, actual text output and environment metadata; each language has its own notebook. The image includes the packages in requirements.txt and base R with jsonlite; add other analysis packages to the image before using them.

## Connections and compute

A custom MCP connector starts disabled and grants no tools. Save a trusted HTTP endpoint or absolute local executable plus arguments, enable discovery, then list the tool names you permit. Agent connector restrictions also apply to model-initiated calls. Errors remain visible instead of being replaced with research results.

SSH hosts use configured keys or your SSH agent, and system or selected known-hosts files. Unknown host keys are rejected. Modal providers use your account tokens and approved Python scripts in bounded sandboxes. A proposal is stored before execution; Approve and run this script starts the saved script. Slurm commands target the numeric job ID returned by the scheduler. Closing a running shell channel does not establish that its remote process stopped.

New model, MCP and compute configuration is encrypted locally. The encryption key is a private file in the same config directory; keep it with the encrypted files when backing up. It is not a system Keychain vault. Environment variables and legacy TOML configuration remain supported.

## Scientific boundaries

The reviewer detects integrity and provenance defects and can retain model commentary. It does not establish scientific correctness, resolve every citation, or rerun an analysis. Structural previews show coordinates and sequences contained in uploaded files; they do not predict structures.

AlphaFold retrieves existing structures. The ESM Atlas tool uses an external folding service. BLAST submits a search and retrieves its alignment through a separate result request; pending jobs retain their waiting state. Database adapters can require credentials or become unavailable. Unreadable or scanned PDFs are reported without claiming text extraction. Scientific previews are bounded. Chemical drawings use source bonds through RDKit; SMILES entry saves a drawing and its molecular identity. BED and GFF intervals retain their source coordinates alongside the display axis. Markdown equations use MathML.

## Tests

```sh
python3 -m unittest discover -s tests -v
```

Provider fixtures test conversation contracts without paid calls. Owned MCP and SSH servers exercise real transports. Kernel integration uses actual Docker and skips when the engine or image is unavailable. Linux CI builds the image and runs those integrations. Slurm tests exercise command wiring through an owned SSH fixture; a real cluster and paid compute providers remain untested. The macOS job also builds the native host and exercises the workspace in WKWebView.

The BLAST result request uses [NCBI's documented retrieval API](https://blast.ncbi.nlm.nih.gov/doc/blast-help/urlapi.html). Repeated requests for the same job reuse a result for sixty seconds.
