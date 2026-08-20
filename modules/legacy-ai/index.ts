import Native from './src/LegacyAIModule';
import type { LegacyAICapabilities, IntentRequest, IntentResponse, SceneResponseRequest, SceneResponseResult, SceneTextRequest, SceneTextResult } from './src/LegacyAI.types';
export * from './src/LegacyAI.types';
const parse=<T>(s:string):T=>JSON.parse(s) as T;
export async function getCapabilities():Promise<LegacyAICapabilities>{return parse(await Native.getCapabilitiesJSON())}
export async function interpretIntent(req:IntentRequest):Promise<IntentResponse>{return parse(await Native.interpretIntentJSON(JSON.stringify(req)))}
export async function classifySceneResponse(req:SceneResponseRequest):Promise<SceneResponseResult>{return parse(await Native.classifySceneResponseJSON(JSON.stringify(req)))}
export async function generateSceneText(req:SceneTextRequest):Promise<SceneTextResult>{return parse(await Native.generateSceneTextJSON(JSON.stringify(req)))}
export async function cancel(requestId:string):Promise<void>{await Native.cancel(requestId)}
export async function clearEphemeralCache():Promise<void>{await Native.clearEphemeralCache()}
