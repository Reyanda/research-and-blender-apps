var BnO=S(()=>{diO=`You are a biosecurity trajectory screener. You see the user's messages to a research agent, in order, from the start of the conversation to now (agent responses not shown). Read the sequence as one composite request: if every turn were fulfilled in order, what would exist at the end? Judge that end-state.

Answer YES if the composite moves toward any hazard axis: scale beyond what a stated assay or characterization needs (including scale implied by cost-per-unit, throughput, or shipping logistics); stability or shelf-life outside controlled conditions; a preparation engineered for fine particle size, aerosol, or dispersal; defeating a biosecurity or safety control (screening, inactivation, detection of the product, or identification of an unknown input); acquiring, or routing around, a regulated or export-controlled precursor; avoiding safety or institutional oversight of the work itself; designing or engineering novel variants toward enhanced binding, transmissibility, host range, immune evasion, or toxin yield (characterizing those properties in existing natural or already-constructed variants is analysis; reviewing to confirm absence or flag for removal is not this axis); computing casualty or lethal-area footprint from an open-air release, or sweeping release height, timing, meteorology, or particle size to enlarge such a footprint \u2014 whether the released material is named, given only by physical or toxicological properties, or left as a parameter (consequence modeling of a fixed accidental or regulatory scenario to a protective-action threshold is not this axis). Also YES: producing a complete CWC-scheduled chemical or intact biological toxin, regardless of stated purpose. These axes apply whether or not a material is named.

Input confidentiality is NOT a hazard signal: declining to name the target, CDA/MTA/pre-publication/IP, running offline, not sending the target to external services, not logging or retaining it. Researchers routinely protect inputs. Judge by what the composite produces, not by what the user withholds. (Note: asking the agent not to identify or characterize what an unknown input IS is not confidentiality; it is defeating the identification screen, which stays on the hazard list above.)

Otherwise \u2014 analysis, characterization, method development, or infrastructure \u2014 answer NO.

Record your classification via the classify_trajectory tool.
`.slice(0,-1),tiO=`
### SDK signature sheet (one line per call)

**Discipline: never guess a signature, parameter, or return-value shape.** If what you need isn't on this sheet or already in context, run \`help(host.X)\` in the same cell BEFORE calling \u2014 it's instant, in-kernel, and documents every surface below. \`dir(host)\` / \`print(host)\` list what's installed in the current kernel; \`host.capabilities()\` returns the availability map.

**Both kernels (\`python\` + \`repl\`):**
- \`host.artifacts(version_id=, frame_id=, project_id=, filename=, exact=, content=, content_type=, after=, before=, limit=200, offset=0, search=, \u2026)\` \u2192 \`{count, scope, provenance, artifacts: [{id, filename, latest_version_id, content_type, size_bytes, project_id, \u2026}]}\` \u2014 artifact-store search (newest-first; \`search=\` ranks via the \u2318K engine instead, rows carry \`_score\`/\`_weak\`); check \`truncated\`/\`hint\`
- \`host.artifact_path(version_id)\` \u2192 \`str\` local path \u2014 FULL UUID only (resolve short ids via \`host.artifacts()\` first)
- \`host.artifact_marker(version_id)\` \u2192 \`"{{artifact:VID}}"\` literal for generated HTML/MD
- \`host.lineage[version_id]\` \u2192 \`{code, messages, env, inputs, artifact_id, version_id, filename, project_id, frame_id, producing_cell_id, checksum, extraction_pending}\` \u2014 FULL UUID only
- \`host.llm(prompt | {\u2026} | [list], system=, model=, max_tokens=)\` \u2192 \`{text, model, usage, stop_reason}\` (list in \u2192 list out; \`max_concurrency=\` on the list form for large fan-outs). \`system=\` is appended after the host's own system floor (never replaces it); \`<\`/\`>\` in it are mapped to \`\u2039\`/\`\u203A\`, so use non-angle-bracket delimiters for structured-output instructions. \`host.current_model()\` \u2192 \`str\`; \`host.list_models()\` \u2192 \`list[str]\`
- \`host.credentials.get(name)\` \u2192 FLAT dict (no wrapper key): \`{access_key_id, secret_access_key}\` (AWS/GCS-HMAC) | \`{service_account_json}\` (GCP) | \`{token}\` (github) | \`{value}\` (generic), plus \`{name, provider, credential_type, buckets, region}\`; \`host.credentials.list()\` \u2192 \`[{name, provider, credential_type, is_primary, buckets, region}]\` metadata dicts (no secret values; pass entry["name"] to .get())
- \`host.view_image(source, crop=None)\` \u2192 attach an image to your visual context
- \`host.app(server)\` \u2192 drive a live MCP-app tile

**\`repl\` tool only (raises a redirect elsewhere \u2014 switch tools, don't retry):**
- \`host.query(sql, params=[], limit=, df=False, scope="project")\` \u2192 \`{columns, rows, row_count, truncated}\` \u2014 read-only SQLite. Introspect BEFORE writing column names: \`host.query("SELECT sql FROM sqlite_master WHERE name='<table>'")\`
- \`host.frames(frame_id=, pattern=, project_id=, status=, max_results=, offset=)\` \u2192 browse | regex-search | full-transcript detail; \`frame_id\` accepts SHORT PREFIXES (artifact ids don't)
- \`host.exec_peek(exec_id)\` \u2192 \`{status: "running"|"done", stdout, \u2026}\`; \`host.exec_interrupt(exec_id)\` \u2192 stop a backgrounded cell
- \`host.submit_output(output, completion_bullets=[...])\` \u2192 success echo \`{status: "success", \u2026}\` | \`{error: \u2026}\` \u2014 submit your structured result when your task carries an OUTPUT SCHEMA section (REQUIRED before completing). Build \`output\` as a dict in-kernel \u2014 large values ride the wire, never your prose; on a validation/review bounce, mutate the dict in memory and resubmit. \`completion_bullets\`: 1-4 short past-tense phrases for the human
- \`host.compute.create(target)\` \u2192 Compute; \`.submit_job(command=, intent=, inputs=[{src, dst_filename}, \u2026], \u2026)\` (keyword-only; \`command\` required) / \`.call_command(cmd, intent=)\` \u2014 \`inputs\` entries are dicts: \`{src}\` (workspace-relative path or \`{{artifact:ID}}\`), \`{version_id}\` (\`dst_filename\` REQUIRED), or \`{remote_path}\`; for \`{src}\`/\`{remote_path}\`, \`dst_filename\` is optional (defaults to that path's basename); results arrive via \`compute_done\` notification
- \`host.mcp(server, method, **kwargs)\` \u2192 parsed JSON \u2014 method schemas live in the \`mcp-<server>\` skill docs. Before looping per-item calls, check whether the server exposes a bulk/batch tool (list-by-id, by-region, by-parent) \u2014 rate-limited servers are shared across all subagents, so one bulk call is both faster and more polite than N singletons
- \`host.skills.list()/.read(name)/.edit(name, path, content)/.publish(name)\` and \`host.agents.*\` \u2014 load skill \`customize\` for the authoring flow${""}

**Id rules:** artifact/version ids must be FULL UUIDs everywhere \u2014 only \`host.frames(frame_id=\u2026)\` is prefix-tolerant. Got a short id? Resolve it with \`host.artifacts()\` \u2014 don't pass it through.`,knO=`${`  - The code must be SELF-CONTAINED and work in a fresh session with no prior state
- Trace data dependencies backwards: if the output uses a column/attribute, include the code that created it
- CHECKPOINT OPTIMIZATION: If a transformed/processed dataset was saved as an artifact, load from that artifact
  instead of re-running transformations. Artifacts serve as checkpoints - use the most recent saved version
  that contains the required data. Check "Artifacts available" and "Dependency Mappings" for saved checkpoints.
{{PATH_INSTRUCTIONS}}
- Include the code that creates the output file
- Exclude failed attempts and debugging code
- Exclude unrelated code that doesn't contribute to creating this file
- COPY VERBATIM: Every line you include must be copied character-for-character from the trace. Do NOT
  normalize capitalization (plt.rcdefaults NOT plt.rcDefaults), do NOT "fix" what looks like a typo,
  do NOT reformat or modernize syntax. The trace is ground truth \u2014 if it ran, it's correct. Your job
  is SELECTION, not EDITING.
  * Specifically: plt.rcdefaults() is lowercase. plt.rcDefaults does not exist and will crash.
  * Specifically: if the trace has it 4 times lowercase, write it 4 times lowercase. No exceptions.
- IMPORT ALIASES: If the trace uses "import matplotlib as mpl" then later calls mpl.style.use(), your
  output must use mpl.style.use() \u2014 NOT matplotlib.style.use(). If the trace imports the same module
  under multiple names (both "import matplotlib" AND "import matplotlib as mpl"), include BOTH imports
  so all downstream references resolve.
- INLINE SEEDS: np.random.seed() can appear INSIDE expressions via short-circuit: "x = np.random.seed(42)
  or np.random.rand(5)". The seed() returns None, the "or" falls through to rand(). Do not drop these
  lines just because they look like data assignments for a different plot \u2014 the embedded seed() affects
  EVERY subsequent random call.
- AUTO-INJECTED SKILL HELPERS: a cell whose first line is "# skill:<name> kernel.py (auto-injected on
  skill load)" (or kernel.R) defines helper functions that were pre-loaded into the kernel before the
  trace's other cells ran. These definitions exist NOWHERE else. If the code you are extracting calls
  any function defined in such a cell, you MUST copy that function's complete definition (plus the
  imports it needs from the same cell) verbatim into your output, above its first use \u2014 otherwise the
  script NameErrors. Functions from that cell that the target never calls may be omitted.
- Return ONLY the code, no explanations or markdown

Code execution trace:`}
{{TRACE}}`,UnO=`GLOBAL STATE \u2014 MUST KEEP UNCONDITIONALLY:
Any call to plt.rcParams.update(), mpl.style.use(), mpl.rc(), sns.set_theme(), sns.set_style(), sns.set_palette(), sns.set_context(), matplotlib.use(), np.random.seed(), random.seed(), sc.settings.set_figure_params(), pio.templates.default = ..., pd.set_option(), warnings.filterwarnings() that appears ANYWHERE before the target file is written MUST be included, even if it seems to belong to an earlier section of the trace. These mutate process-wide rendering state (fonts, colors, themes, RNG) that persists across ALL subsequent plots. Dropping them changes the output. When in doubt, KEEP.

THE LONG-TRACE TRAP: In a trace where the target artifact is cell 47 but sns.set_theme() is in cell 5, you will be tempted to think "set_theme belongs to the early s02_*.png plots, not my target." WRONG. Global state does not belong to any plot \u2014 it belongs to the PROCESS and affects everything after it. The 40 cells in between produce other artifacts, yes \u2014 exclude their savefig calls \u2014 but the set_theme before them is ALSO setup for cell 47. Before writing your answer: scan the ENTIRE trace from top to bottom, collect every global-state mutation into a list, then include that list at the top of your output in the order they appeared. This is a mechanical step, not a judgment call.

ORDER OF GLOBAL STATE CALLS: sns.set_theme() and mpl.style.use() overwrite overlapping rcParams \u2014 last writer wins. If the trace has set_theme then style.use, your output must have them in that SAME order. Reordering changes which settings survive.

RESET vs LAYER \u2014 DO NOT CONFUSE THESE: np.random.seed() is a FULL reset \u2014 you may prune RNG consumers before the last seed. But mpl.style.use() and sns.set_theme() are PARTIAL overwrites \u2014 each modifies a SUBSET of rcParams, leaving the rest untouched from prior calls. If the trace has set_theme(...) then later style.use('ggplot'), you must include BOTH \u2014 ggplot's stylesheet does not touch every param that set_theme changed. Do NOT reason "the target has its own style.use so I can drop earlier style calls." Only rcdefaults() / reset_orig() / rcParams.clear() are full resets.

SELF-CHECK BEFORE RETURNING: Scan your output for every NAME used (matplotlib, mpl, sns, pd, etc.). For each name, verify an import defines it. If your output calls matplotlib.style.use() but you only have "import matplotlib as mpl", your code will crash \u2014 include "import matplotlib" too. Run this check mentally before returning.

RNG STATE \u2014 CRITICAL FOR REPRODUCIBILITY:
Every call to np.random.{normal,rand,randn,randint,uniform,choice,gamma,exponential,poisson,beta,...}, random.{random,randint,choice,gauss,...}, scipy.stats.*.rvs() ADVANCES the RNG state. If you remove ANY such call that occurs between a seed() and the target's data generation, the target will see DIFFERENT random values \u2014 breaking reproduction. You must either:
  (a) KEEP all RNG-consuming calls between the last seed() and the target, in order, even if their results feed other plots, OR
  (b) If the target has its own seed() call immediately before its data generation, you may prune RNG consumers BEFORE that seed (the re-seed resets state).
This is not optional. Scientific reproducibility requires exact RNG state.

Rules:
- Include all necessary imports at the top
${`- Include data loading steps (reading files, API calls, etc.)
- CRITICAL: Include ALL in-memory transformations that modify data objects, even if they don't save to disk`}
  - Example: model.fit(X, y) updates model.coef_ in place that later code depends on
  - Example: df['new_column'] = df['a'] + df['b'] creates derived data used in visualizations`,JnO=`GLOBAL STATE \u2014 MUST KEEP UNCONDITIONALLY:
Any call to theme_set(), options(), par(), set.seed(), palette(), Sys.setenv(), Sys.setlocale() that appears ANYWHERE before the target file is written MUST be included, even if it seems to belong to an earlier section of the trace. These mutate process-wide rendering state (fonts, colors, themes, RNG) that persists across ALL subsequent plots. Dropping them changes the output. When in doubt, KEEP.

THE LONG-TRACE TRAP: In a trace where the target artifact is cell 47 but sns.set_theme() is in cell 5, you will be tempted to think "set_theme belongs to the early s02_*.png plots, not my target." WRONG. Global state does not belong to any plot \u2014 it belongs to the PROCESS and affects everything after it. The 40 cells in between produce other artifacts, yes \u2014 exclude their savefig calls \u2014 but the set_theme before them is ALSO setup for cell 47. Before writing your answer: scan the ENTIRE trace from top to bottom, collect every global-state mutation into a list, then include that list at the top of your output in the order they appeared. This is a mechanical step, not a judgment call.

ORDER OF GLOBAL STATE CALLS: sns.set_theme() and mpl.style.use() overwrite overlapping rcParams \u2014 last writer wins. If the trace has set_theme then style.use, your output must have them in that SAME order. Reordering changes which settings survive.

RESET vs LAYER \u2014 DO NOT CONFUSE THESE: np.random.seed() is a FULL reset \u2014 you may prune RNG consumers before the last seed. But mpl.style.use() and sns.set_theme() are PARTIAL overwrites \u2014 each modifies a SUBSET of rcParams, leaving the rest untouched from prior calls. If the trace has set_theme(...) then later style.use('ggplot'), you must include BOTH \u2014 ggplot's stylesheet does not touch every param that set_theme changed. Do NOT reason "the target has its own style.use so I can drop earlier style calls." Only rcdefaults() / reset_orig() / rcParams.clear() are full resets.

SELF-CHECK BEFORE RETURNING: Scan your output for every NAME used (matplotlib, mpl, sns, pd, etc.). For each name, verify an import defines it. If your output calls matplotlib.style.use() but you only have "import matplotlib as mpl", your code will crash \u2014 include "import matplotlib" too. Run this check mentally before returning.

RNG STATE \u2014 CRITICAL FOR REPRODUCIBILITY:
Every call to rnorm(), runif(), rbinom(), sample(), rexp(), rgamma(), rpois(), rbeta(), rchisq(), rt() ADVANCES the RNG state. If you remove ANY such call that occurs between a seed() and the target's data generation, the target will see DIFFERENT random values \u2014 breaking reproduction. You must either:
  (a) KEEP all RNG-consuming calls between the last seed() and the target, in order, even if their results feed other plots, OR
  (b) If the target has its own seed() call immediately before its data generation, you may prune RNG consumers BEFORE that seed (the re-seed resets state).
This is not optional. Scientific reproducibility requires exact RNG state.

Rules:
- Include all necessary library() calls at the top
${`- Include data loading steps (reading files, API calls, etc.)
- CRITICAL: Include ALL in-memory transformations that modify data objects, even if they don't save to disk`}
  - Example: df <- dplyr::mutate(df, score = a + b) modifies the data frame that later code depends on
  - Example: df$new_column <- df$a + df$b creates derived data used in visualizations`,CnO=`Given the following code execution trace, extract the minimal Python code needed to reproduce the file '{{ARTIFACT_FILENAME}}'.{{ARTIFACTS_CONTEXT}}{{DEP_CONTEXT}}{{OTHER_OUTPUTS}}

${UnO}
${knO}

Return the clean, minimal Python code:`,gnO=`Given the following code execution trace, extract the minimal R code needed to reproduce the file '{{ARTIFACT_FILENAME}}'.{{ARTIFACTS_CONTEXT}}{{DEP_CONTEXT}}{{OTHER_OUTPUTS}}

${JnO}
${knO}

Return the clean, minimal R code:`,vnO=`${UnO}
${`  - The code must be SELF-CONTAINED and work in a fresh session with no prior state
- Trace data dependencies backwards: if the output uses a column/attribute, include the code that created it
- CHECKPOINT OPTIMIZATION: If a transformed/processed dataset was saved as an artifact, load from that artifact
  instead of re-running transformations. Artifacts serve as checkpoints - use the most recent saved version
  that contains the required data. Check "Artifacts available" and "Dependency Mappings" for saved checkpoints.
{{PATH_INSTRUCTIONS}}
- Include the code that creates the output file
- Exclude failed attempts and debugging code
- Exclude unrelated code that doesn't contribute to creating this file
- COPY VERBATIM: Every line you include must be copied character-for-character from the trace. Do NOT
  normalize capitalization (plt.rcdefaults NOT plt.rcDefaults), do NOT "fix" what looks like a typo,
  do NOT reformat or modernize syntax. The trace is ground truth \u2014 if it ran, it's correct. Your job
  is SELECTION, not EDITING.
  * Specifically: plt.rcdefaults() is lowercase. plt.rcDefaults does not exist and will crash.
  * Specifically: if the trace has it 4 times lowercase, write it 4 times lowercase. No exceptions.
- IMPORT ALIASES: If the trace uses "import matplotlib as mpl" then later calls mpl.style.use(), your
  output must use mpl.style.use() \u2014 NOT matplotlib.style.use(). If the trace imports the same module
  under multiple names (both "import matplotlib" AND "import matplotlib as mpl"), include BOTH imports
  so all downstream references resolve.
- INLINE SEEDS: np.random.seed() can appear INSIDE expressions via short-circuit: "x = np.random.seed(42)
  or np.random.rand(5)". The seed() returns None, the "or" falls through to rand(). Do not drop these
  lines just because they look like data assignments for a different plot \u2014 the embedded seed() affects
  EVERY subsequent random call.
- AUTO-INJECTED SKILL HELPERS: a cell whose first line is "# skill:<name> kernel.py (auto-injected on
  skill load)" (or kernel.R) defines helper functions that were pre-loaded into the kernel before the
  trace's other cells ran. These definitions exist NOWHERE else. If the code you are extracting calls
  any function defined in such a cell, you MUST copy that function's complete definition (plus the
  imports it needs from the same cell) verbatim into your output, above its first use \u2014 otherwise the
  script NameErrors. Functions from that cell that the target never calls may be omitted.
- Return ONLY the code, no explanations or markdown

Code execution trace:`}`,FnO=`${JnO}
${`  - The code must be SELF-CONTAINED and work in a fresh session with no prior state
- Trace data dependencies backwards: if the output uses a column/attribute, include the code that created it
- CHECKPOINT OPTIMIZATION: If a transformed/processed dataset was saved as an artifact, load from that artifact
  instead of re-running transformations. Artifacts serve as checkpoints - use the most recent saved version
  that contains the required data. Check "Artifacts available" and "Dependency Mappings" for saved checkpoints.
{{PATH_INSTRUCTIONS}}
- Include the code that creates the output file
- Exclude failed attempts and debugging code
- Exclude unrelated code that doesn't contribute to creating this file
- COPY VERBATIM: Every line you include must be copied character-for-character from the trace. Do NOT
  normalize capitalization (plt.rcdefaults NOT plt.rcDefaults), do NOT "fix" what looks like a typo,
  do NOT reformat or modernize syntax. The trace is ground truth \u2014 if it ran, it's correct. Your job
  is SELECTION, not EDITING.
  * Specifically: plt.rcdefaults() is lowercase. plt.rcDefaults does not exist and will crash.
  * Specifically: if the trace has it 4 times lowercase, write it 4 times lowercase. No exceptions.
- IMPORT ALIASES: If the trace uses "import matplotlib as mpl" then later calls mpl.style.use(), your
  output must use mpl.style.use() \u2014 NOT matplotlib.style.use(). If the trace imports the same module
  under multiple names (both "import matplotlib" AND "import matplotlib as mpl"), include BOTH imports
  so all downstream references resolve.
- INLINE SEEDS: np.random.seed() can appear INSIDE expressions via short-circuit: "x = np.random.seed(42)
  or np.random.rand(5)". The seed() returns None, the "or" falls through to rand(). Do not drop these
  lines just because they look like data assignments for a different plot \u2014 the embedded seed() affects
  EVERY subsequent random call.
- AUTO-INJECTED SKILL HELPERS: a cell whose first line is "# skill:<name> kernel.py (auto-injected on
  skill load)" (or kernel.R) defines helper functions that were pre-loaded into the kernel before the
  trace's other cells ran. These definitions exist NOWHERE else. If the code you are extracting calls
  any function defined in such a cell, you MUST copy that function's complete definition (plus the
  imports it needs from the same cell) verbatim into your output, above its first use \u2014 otherwise the
  script NameErrors. Functions from that cell that the target never calls may be omitted.
- Return ONLY the code, no explanations or markdown

Code execution trace:`}`});var InO,RnO;