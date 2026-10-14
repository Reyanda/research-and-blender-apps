
//#region ../../app-core/dist/index.js
let AssistantEvent = function(AssistantEvent$1) {
	/** The `OnAssistantsUpdate` event is emitted when the assistant list is updated. */
	AssistantEvent$1["OnAssistantsUpdate"] = "OnAssistantsUpdate";
	return AssistantEvent$1;
}({});
let ModelEvent = function(ModelEvent$1) {
	/** The `OnModelInit` event is emitted when a model inits. */
	ModelEvent$1["OnModelInit"] = "OnModelInit";
	/** The `OnModelReady` event is emitted when a model ready. */
	ModelEvent$1["OnModelReady"] = "OnModelReady";
	/** The `OnModelFail` event is emitted when a model fails loading. */
	ModelEvent$1["OnModelFail"] = "OnModelFail";
	/** The `OnModelStop` event is emitted when a model start to stop. */
	ModelEvent$1["OnModelStop"] = "OnModelStop";
	/** The `OnModelStopped` event is emitted when a model stopped ok. */
	ModelEvent$1["OnModelStopped"] = "OnModelStopped";
	/** The `OnModelUpdate` event is emitted when the model list is updated. */
	ModelEvent$1["OnModelsUpdate"] = "OnModelsUpdate";
	return ModelEvent$1;
}({});
let MessageStatus = function(MessageStatus$1) {
	/** Message is fully loaded. **/
	MessageStatus$1["Ready"] = "ready";
	/** Message is not fully loaded. **/
	MessageStatus$1["Pending"] = "pending";
	/** Message loaded with error. **/
	MessageStatus$1["Error"] = "error";
	/** Message is cancelled streaming */
	MessageStatus$1["Stopped"] = "stopped";
	return MessageStatus$1;
}({});
let ErrorCode = function(ErrorCode$1) {
	ErrorCode$1["InvalidApiKey"] = "invalid_api_key";
	ErrorCode$1["AuthenticationError"] = "authentication_error";
	ErrorCode$1["InsufficientQuota"] = "insufficient_quota";
	ErrorCode$1["InvalidRequestError"] = "invalid_request_error";
	ErrorCode$1["Unknown"] = "unknown";
	return ErrorCode$1;
}({});
let ContentType = function(ContentType$1) {
	ContentType$1["Text"] = "text";
	ContentType$1["Reasoning"] = "reasoning";
	ContentType$1["Image"] = "image_url";
	ContentType$1["ToolCall"] = "tool_call";
	return ContentType$1;
}({});
let MessageEvent = function(MessageEvent$1) {
	/** The `OnMessageSent` event is emitted when a message is sent. */
	MessageEvent$1["OnMessageSent"] = "OnMessageSent";
	/** The `OnMessageResponse` event is emitted when a message is received. */
	MessageEvent$1["OnMessageResponse"] = "OnMessageResponse";
	/** The `OnMessageUpdate` event is emitted when a message is updated. */
	MessageEvent$1["OnMessageUpdate"] = "OnMessageUpdate";
	return MessageEvent$1;
}({});
let MessageRequestType = function(MessageRequestType$1) {
	MessageRequestType$1["Thread"] = "Thread";
	MessageRequestType$1["Assistant"] = "Assistant";
	MessageRequestType$1["Summary"] = "Summary";
	return MessageRequestType$1;
}({});
let ChatCompletionRole = function(ChatCompletionRole$1) {
	ChatCompletionRole$1["System"] = "system";
	ChatCompletionRole$1["Assistant"] = "assistant";
	ChatCompletionRole$1["User"] = "user";
	ChatCompletionRole$1["Tool"] = "tool";
	return ChatCompletionRole$1;
}({});
let ChatCompletionMessageContentType = function(ChatCompletionMessageContentType$1) {
	ChatCompletionMessageContentType$1["Text"] = "text";
	ChatCompletionMessageContentType$1["Image"] = "image_url";
	ChatCompletionMessageContentType$1["Doc"] = "doc_url";
	return ChatCompletionMessageContentType$1;
}({});
let InferenceEvent = function(InferenceEvent$1) {
	/** The `OnInferenceStopped` event is emitted when a inference is stopped. */
	InferenceEvent$1["OnInferenceStopped"] = "OnInferenceStopped";
	return InferenceEvent$1;
}({});
let AppConfigurationEventName = function(AppConfigurationEventName$1) {
	AppConfigurationEventName$1["OnConfigurationUpdate"] = "OnConfigurationUpdate";
	return AppConfigurationEventName$1;
}({});
let NativeRoute = function(NativeRoute$1) {
	NativeRoute$1["openExternalUrl"] = "openExternalUrl";
	NativeRoute$1["openAppDirectory"] = "openAppDirectory";
	NativeRoute$1["openFileExplore"] = "openFileExplorer";
	NativeRoute$1["selectDirectory"] = "selectDirectory";
	NativeRoute$1["selectFiles"] = "selectFiles";
	NativeRoute$1["relaunch"] = "relaunch";
	NativeRoute$1["setNativeThemeLight"] = "setNativeThemeLight";
	NativeRoute$1["setNativeThemeDark"] = "setNativeThemeDark";
	NativeRoute$1["setMinimizeApp"] = "setMinimizeApp";
	NativeRoute$1["setCloseApp"] = "setCloseApp";
	NativeRoute$1["setMaximizeApp"] = "setMaximizeApp";
	NativeRoute$1["showOpenMenu"] = "showOpenMenu";
	NativeRoute$1["hideQuickAskWindow"] = "hideQuickAskWindow";
	NativeRoute$1["sendQuickAskInput"] = "sendQuickAskInput";
	NativeRoute$1["hideMainWindow"] = "hideMainWindow";
	NativeRoute$1["showMainWindow"] = "showMainWindow";
	NativeRoute$1["quickAskSizeUpdated"] = "quickAskSizeUpdated";
	NativeRoute$1["ackDeepLink"] = "ackDeepLink";
	NativeRoute$1["factoryReset"] = "factoryReset";
	NativeRoute$1["startServer"] = "startServer";
	NativeRoute$1["stopServer"] = "stopServer";
	NativeRoute$1["appUpdateDownload"] = "appUpdateDownload";
	NativeRoute$1["appToken"] = "appToken";
	return NativeRoute$1;
}({});
let AppRoute = function(AppRoute$1) {
	AppRoute$1["getAppConfigurations"] = "getAppConfigurations";
	AppRoute$1["updateAppConfiguration"] = "updateAppConfiguration";
	AppRoute$1["joinPath"] = "joinPath";
	AppRoute$1["dirName"] = "dirName";
	AppRoute$1["isSubdirectory"] = "isSubdirectory";
	AppRoute$1["baseName"] = "baseName";
	AppRoute$1["log"] = "log";
	AppRoute$1["showToast"] = "showToast";
	return AppRoute$1;
}({});
let AppEvent = function(AppEvent$1) {
	AppEvent$1["onAppUpdateNotAvailable"] = "onAppUpdateNotAvailable";
	AppEvent$1["onAppUpdateAvailable"] = "onAppUpdateAvailable";
	AppEvent$1["onAppUpdateDownloadUpdate"] = "onAppUpdateDownloadUpdate";
	AppEvent$1["onAppUpdateDownloadError"] = "onAppUpdateDownloadError";
	AppEvent$1["onAppUpdateDownloadSuccess"] = "onAppUpdateDownloadSuccess";
	AppEvent$1["onModelImported"] = "onModelImported";
	AppEvent$1["onUserSubmitQuickAsk"] = "onUserSubmitQuickAsk";
	AppEvent$1["onSelectedText"] = "onSelectedText";
	AppEvent$1["onDeepLink"] = "onDeepLink";
	AppEvent$1["onMainViewStateChange"] = "onMainViewStateChange";
	return AppEvent$1;
}({});
let DownloadEvent = function(DownloadEvent$1) {
	DownloadEvent$1["onFileDownloadUpdate"] = "onFileDownloadUpdate";
	DownloadEvent$1["onFileDownloadError"] = "onFileDownloadError";
	DownloadEvent$1["onFileDownloadSuccess"] = "onFileDownloadSuccess";
	DownloadEvent$1["onFileDownloadStopped"] = "onFileDownloadStopped";
	DownloadEvent$1["onFileDownloadStarted"] = "onFileDownloadStarted";
	DownloadEvent$1["onModelValidationStarted"] = "onModelValidationStarted";
	DownloadEvent$1["onModelValidationFailed"] = "onModelValidationFailed";
	DownloadEvent$1["onFileDownloadAndVerificationSuccess"] = "onFileDownloadAndVerificationSuccess";
	return DownloadEvent$1;
}({});
let ExtensionRoute = function(ExtensionRoute$1) {
	ExtensionRoute$1["baseExtensions"] = "baseExtensions";
	ExtensionRoute$1["getActiveExtensions"] = "getActiveExtensions";
	ExtensionRoute$1["installExtension"] = "installExtension";
	ExtensionRoute$1["invokeExtensionFunc"] = "invokeExtensionFunc";
	ExtensionRoute$1["updateExtension"] = "updateExtension";
	ExtensionRoute$1["uninstallExtension"] = "uninstallExtension";
	return ExtensionRoute$1;
}({});
let FileSystemRoute = function(FileSystemRoute$1) {
	FileSystemRoute$1["appendFileSync"] = "appendFileSync";
	FileSystemRoute$1["unlinkSync"] = "unlinkSync";
	FileSystemRoute$1["existsSync"] = "existsSync";
	FileSystemRoute$1["readdirSync"] = "readdirSync";
	FileSystemRoute$1["rm"] = "rm";
	FileSystemRoute$1["mv"] = "mv";
	FileSystemRoute$1["mkdir"] = "mkdir";
	FileSystemRoute$1["readFileSync"] = "readFileSync";
	FileSystemRoute$1["writeFileSync"] = "writeFileSync";
	return FileSystemRoute$1;
}({});
let FileManagerRoute = function(FileManagerRoute$1) {
	FileManagerRoute$1["copyFile"] = "copyFile";
	FileManagerRoute$1["getJanDataFolderPath"] = "getJanDataFolderPath";
	FileManagerRoute$1["getResourcePath"] = "getResourcePath";
	FileManagerRoute$1["getUserHomePath"] = "getUserHomePath";
	FileManagerRoute$1["fileStat"] = "fileStat";
	FileManagerRoute$1["writeBlob"] = "writeBlob";
	FileManagerRoute$1["getGgufFiles"] = "getGgufFiles";
	return FileManagerRoute$1;
}({});
const CoreRoutes = [
	...Object.values(AppRoute),
	...Object.values(ExtensionRoute),
	...Object.values(FileSystemRoute),
	...Object.values(FileManagerRoute),
	"launchClaudeCodeWithConfig",
	"writeEnvFileToConfig"
];
const APIRoutes = [...CoreRoutes, ...Object.values(NativeRoute)];
const APIEvents = [...Object.values(AppEvent), ...Object.values(DownloadEvent)];
let EngineEvent = function(EngineEvent$1) {
	EngineEvent$1["OnEngineUpdate"] = "OnEngineUpdate";
	return EngineEvent$1;
}({});
/**
* Adds an observer for an event.
*
* @param eventName The name of the event to observe.
* @param handler The handler function to call when the event is observed.
*/
const on = (eventName, handler) => {
	globalThis.core?.events?.on(eventName, handler);
};
/**
* Removes an observer for an event.
*
* @param eventName The name of the event to stop observing.
* @param handler The handler function to call when the event is observed.
*/
const off = (eventName, handler) => {
	globalThis.core?.events?.off(eventName, handler);
};
/**
* Emits an event.
*
* @param eventName The name of the event to emit.
* @param object The object to pass to the event callback.
*/
const emit = (eventName, object) => {
	globalThis.core?.events?.emit(eventName, object);
};
const events = {
	on,
	off,
	emit
};
var ModelManager = class ModelManager$1 {
	models = new Map();
	constructor() {
		if (window) window.core.modelManager = this;
	}
	/**
	* Registers a model.
	* @param model - The model to register.
	*/
	register(model) {
		if (this.models.has(model.id)) this.models.set(model.id, {
			...model,
			...this.models.get(model.id)
		});
else this.models.set(model.id, model);
		events.emit(ModelEvent.OnModelsUpdate, {});
	}
	/**
	* Retrieves a model by it's id.
	* @param id - The id of the model to retrieve.
	* @returns The model, if found.
	*/
	get(id) {
		return this.models.get(id);
	}
	/**
	* Shared instance of ExtensionManager.
	*/
	static instance() {
		if (!window.core.modelManager) window.core.modelManager = new ModelManager$1();
		return window.core.modelManager;
	}
};
let ExtensionTypeEnum = function(ExtensionTypeEnum$1) {
	ExtensionTypeEnum$1["Assistant"] = "assistant";
	ExtensionTypeEnum$1["Conversational"] = "conversational";
	ExtensionTypeEnum$1["Inference"] = "inference";
	ExtensionTypeEnum$1["Model"] = "model";
	ExtensionTypeEnum$1["SystemMonitoring"] = "systemMonitoring";
	ExtensionTypeEnum$1["MCP"] = "mcp";
	ExtensionTypeEnum$1["HuggingFace"] = "huggingFace";
	ExtensionTypeEnum$1["Engine"] = "engine";
	ExtensionTypeEnum$1["Hardware"] = "hardware";
	ExtensionTypeEnum$1["RAG"] = "rag";
	ExtensionTypeEnum$1["VectorDB"] = "vectorDB";
	return ExtensionTypeEnum$1;
}({});
var BaseExtension = class {
	settingFolderName = "settings";
	settingFileName = "settings.json";
	/** @type {string} Name of the extension. */
	name;
	/** @type {string} Product Name of the extension. */
	productName;
	/** @type {string} The URL of the extension to load. */
	url;
	/** @type {boolean} Whether the extension is activated or not. */
	active;
	/** @type {string} Extension's description. */
	description;
	/** @type {string} Extension's version. */
	version;
	constructor(url, name, productName, active, description, version) {
		this.name = name;
		this.productName = productName;
		this.url = url;
		this.active = active;
		this.description = description;
		this.version = version;
	}
	/**
	* Returns the type of the extension.
	* @returns {ExtensionType} The type of the extension
	* Undefined means its not extending any known extension by the application.
	*/
	type() {
		return undefined;
	}
	/**
	* The compatibility of the extension.
	* This is used to check if the extension is compatible with the current environment.
	* @property {Array} platform
	*/
	compatibility() {
		return undefined;
	}
	/**
	* Registers models - it persists in-memory shared ModelManager instance's data map.
	* @param models
	*/
	async registerModels(models) {
		for (const model of models) ModelManager.instance().register(model);
	}
	/**
	* Register settings for the extension.
	* @param settings
	* @returns
	*/
	async registerSettings(settings) {
		if (!this.name) {
			console.error("Extension name is not defined");
			return;
		}
		settings.forEach((setting) => {
			setting.extensionName = this.name;
		});
		try {
			const oldSettingsJson = localStorage.getItem(this.name);
			if (oldSettingsJson) {
				const oldSettings = JSON.parse(oldSettingsJson);
				settings.forEach((setting) => {
					if (setting.controllerProps && Array.isArray(oldSettings)) setting.controllerProps.value = oldSettings.find((e) => e.key === setting.key)?.controllerProps?.value ?? setting.controllerProps.value;
					if ("options" in setting.controllerProps) {
						setting.controllerProps.options = setting.controllerProps.options?.length ? setting.controllerProps.options : oldSettings.find((e) => e.key === setting.key)?.controllerProps?.options;
						if (!setting.controllerProps.options?.some((e) => e.value === setting.controllerProps.value)) setting.controllerProps.value = setting.controllerProps.options?.[0]?.value ?? setting.controllerProps.value;
					}
					if ("recommended" in setting.controllerProps) {
						const oldRecommended = oldSettings.find((e) => e.key === setting.key)?.controllerProps?.recommended;
						if (oldRecommended !== undefined && oldRecommended !== "") setting.controllerProps.recommended = oldRecommended;
					}
				});
			}
			localStorage.setItem(this.name, JSON.stringify(settings));
		} catch (err) {
			console.error(err);
		}
	}
	/**
	* Get the setting value for the key.
	* @param key
	* @param defaultValue
	* @returns
	*/
	async getSetting(key, defaultValue) {
		const keySetting = (await this.getSettings()).find((setting) => setting.key === key);
		const value = keySetting?.controllerProps.value;
		return value ?? defaultValue;
	}
	onSettingUpdate(key, value) {
		return;
	}
	/**
	* Install the prerequisites for the extension.
	*
	* @returns {Promise<void>}
	*/
	async install() {
		return;
	}
	/**
	* Get the settings for the extension.
	* @returns
	*/
	async getSettings() {
		if (!this.name) return [];
		try {
			const settingsString = localStorage.getItem(this.name);
			if (!settingsString) return [];
			const settings = JSON.parse(settingsString);
			return settings;
		} catch (err) {
			console.warn(err);
			return [];
		}
	}
	/**
	* Update the settings for the extension.
	* @param componentProps
	* @returns
	*/
	async updateSettings(componentProps) {
		if (!this.name) return;
		const settings = await this.getSettings();
		let updatedSettings = settings.map((setting) => {
			const updatedSetting = componentProps.find((componentProp) => componentProp.key === setting.key);
			if (updatedSetting && updatedSetting.controllerProps) setting.controllerProps.value = updatedSetting.controllerProps.value;
			return setting;
		});
		if (!updatedSettings.length) updatedSettings = componentProps;
		localStorage.setItem(this.name, JSON.stringify(updatedSettings));
		updatedSettings.forEach((setting) => {
			this.onSettingUpdate(setting.key, setting.controllerProps.value);
		});
	}
};
var ConversationalExtension = class extends BaseExtension {
	/**
	* Conversation extension type.
	*/
	type() {
		return ExtensionTypeEnum.Conversational;
	}
};

//#endregion
//#region src/index.ts
var JanConversationalExtension = class extends ConversationalExtension {
	/**
	* Called when the extension is loaded.
	*/
	async onLoad() {}
	/**
	* Called when the extension is unloaded.
	*/
	onUnload() {}
	/**
	* Returns a Promise that resolves to an array of Conversation objects.
	*/
	async listThreads() {
		return window.core.api.listThreads();
	}
	/**
	* Saves a Thread object to a json file.
	* @param thread The Thread object to save.
	*/
	async createThread(thread) {
		return window.core.api.createThread({ thread });
	}
	/**
	* Saves a Thread object to a json file.
	* @param thread The Thread object to save.
	*/
	async modifyThread(thread) {
		return window.core.api.modifyThread({ thread });
	}
	/**
	* Delete a thread with the specified ID.
	* @param threadId The ID of the thread to delete.
	*/
	async deleteThread(threadId) {
		return window.core.api.deleteThread({ threadId });
	}
	/**
	* Adds a new message to a specified thread.
	* @param message The ThreadMessage object to be added.
	* @returns A Promise that resolves when the message has been added.
	*/
	async createMessage(message) {
		return window.core.api.createMessage({ message });
	}
	/**
	* Modifies a message in a thread.
	* @param message
	* @returns
	*/
	async modifyMessage(message) {
		return window.core.api.modifyMessage({ message });
	}
	/**
	* Deletes a specific message from a thread.
	* @param threadId The ID of the thread containing the message.
	* @param messageId The ID of the message to be deleted.
	* @returns A Promise that resolves when the message has been successfully deleted.
	*/
	async deleteMessage(threadId, messageId) {
		return window.core.api.deleteMessage({
			threadId,
			messageId
		});
	}
	/**
	* Retrieves all messages for a specified thread.
	* @param threadId The ID of the thread to get messages from.
	* @returns A Promise that resolves to an array of ThreadMessage objects.
	*/
	async listMessages(threadId) {
		return window.core.api.listMessages({ threadId });
	}
	/**
	* Retrieves the assistant information for a specified thread.
	* @param threadId The ID of the thread for which to retrieve assistant information.
	* @returns A Promise that resolves to a ThreadAssistantInfo object containing
	* the details of the assistant associated with the specified thread.
	*/
	async getThreadAssistant(threadId) {
		return window.core.api.getThreadAssistant({ threadId });
	}
	/**
	* Creates a new assistant for the specified thread.
	* @param threadId The ID of the thread for which the assistant is being created.
	* @param assistant The information about the assistant to be created.
	* @returns A Promise that resolves to the newly created ThreadAssistantInfo object.
	*/
	async createThreadAssistant(threadId, assistant) {
		return window.core.api.createThreadAssistant(threadId, assistant);
	}
	/**
	* Modifies an existing assistant for the specified thread.
	* @param threadId The ID of the thread for which the assistant is being modified.
	* @param assistant The updated information for the assistant.
	* @returns A Promise that resolves to the updated ThreadAssistantInfo object.
	*/
	async modifyThreadAssistant(threadId, assistant) {
		return window.core.api.modifyThreadAssistant({
			threadId,
			assistant
		});
	}
};

//#endregion
export { JanConversationalExtension as default };