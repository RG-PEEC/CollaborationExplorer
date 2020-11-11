import { getClientVar } from './clientVar';
import { Session } from 'meteor/session'

export function getStreamPos() {
    return Number(getClientVar("streamframe.pos" + Session.get("projectId"))) || 0;
}
