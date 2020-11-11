import { uuidv4 } from "../ui/utils/guid";

export class Tag {
    constructor(text, startSec, durationSec, type, participants) {
        this.id = uuidv4();
        this.text = text;
        this.startSec = startSec;
        this.durationSec = durationSec;
        this.type = type;
        this.participants = participants;
    }
}