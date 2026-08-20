import { requireNativeModule } from 'expo';
type NativeLegacyAI={getCapabilitiesJSON():Promise<string>;interpretIntentJSON(json:string):Promise<string>;classifySceneResponseJSON(json:string):Promise<string>;generateSceneTextJSON(json:string):Promise<string>;cancel(requestId:string):Promise<void>;clearEphemeralCache():Promise<void>};
export default requireNativeModule<NativeLegacyAI>('LegacyAI');
