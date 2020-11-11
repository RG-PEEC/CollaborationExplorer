import { Mongo } from 'meteor/mongo';
import { Projects } from './projects';

export class CouplingType {
    constructor(name, color, multipleOnly = true, noRendering = false) {
        this.name = name;
        this.color = color;
        this.multipleOnly = multipleOnly;
        this.noRendering = noRendering;
    }
}

export function getCouplingType(projectId, name) {
    const project = Projects.findOne({ _id: projectId }, { fields: { couplingTypes: 1 } });
    const couplingType = project.couplingTypes.find(t => t.name == name);
    if (!couplingType)
        return new CouplingType(name, '#999999');
    return couplingType;
}

export function getCouplingTypes(projectId) {
    return Projects.findOne({ _id: projectId }, { fields: { couplingTypes: 1 } }).couplingTypes;
}

export function getCouplingTypeColor(projectId, name) {
    return getCouplingType(projectId, name).color || '#999999';
}