import { Projects } from "./projects";
import { uuidv4 } from "../ui/utils/guid";

export class Domino {
    constructor(personToCoupling, personToRoom, activePersons, startSec, durationSec, comment) {
        this.id = uuidv4();
        this.personToCoupling = personToCoupling; // name mapping e.g. personToCoupling[0] = 'DISC'
        this.personToRoom = personToRoom; // e.g. personToRoom[0] = 0 means person 0 is in room 0
        this.activePersons = activePersons; // e.g. [0, 2, 3]
        this.startSec = startSec;
        this.durationSec = durationSec;
        this.comment = comment;
    }

    refreshId = () => {
        this.id = uuidv4();
    }
}