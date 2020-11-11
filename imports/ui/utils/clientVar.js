import { ReactiveDict } from 'meteor/reactive-dict';

const clientVars = new ReactiveDict();

$(window).bind("storage", function (e) {
    clientVars.set(e.originalEvent.key, e.originalEvent.newValue);
});

export function getClientVar(name) {
    clientVars.setDefault(name, localStorage.getItem(name));
    return clientVars.get(name);
}

export function setClientVar(name, value) {
    clientVars.set(name, value);
    localStorage.setItem(name, value);
}