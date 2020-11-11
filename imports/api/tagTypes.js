import { Mongo } from 'meteor/mongo';
import { Projects } from './projects';

export class TagType {
    constructor(name, color) {
        this.name = name;
        this.color = color;
    }
}

export function getTagTypes(projectId) {
    return Projects.findOne({ _id: projectId }, { fields: { tagTypes: 1 } }).tagTypes;
}