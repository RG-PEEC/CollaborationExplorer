import Papa from 'papaparse';
import { Domino } from '../../api/domino';
import { getSecondsFromFormattedTime, getFormattedTimeFromSeconds } from './timeFormatting';
import _ from 'lodash';

export function downloadObject(obj, name, ext = "json") {
    download(name + "." + ext, JSON.stringify(obj, null, 2));
}

export function createCsvFromObjects(objects) {
    if (objects === [])
        return "";

    return Papa.unparse(objects);
}

export function createCsvFromDominos(dominos) {
    const dominosCsvFormat = [];
    let subgroup = 1;
    for (const domino of dominos) {
        let subgroupLatest = subgroup;

        const couplings = _.uniq(domino.personToCoupling);
        for (const coupling of couplings) {
            const dominoCsvStart = {
                Timestamp: getFormattedTimeFromSeconds(domino.startSec),
                Event: "NS",
                Subgroup: subgroupLatest,
                P1: domino.personToCoupling[0] === coupling ? 1 : 0,
                P2: domino.personToCoupling[1] === coupling ? 1 : 0,
                P3: domino.personToCoupling[2] === coupling ? 1 : 0,
                P4: domino.personToCoupling[3] === coupling ? 1 : 0,
                Coupling: coupling,
                Comment: (domino.comment || "").replace(/\n/g, "\\n"),
            };

            dominosCsvFormat.push(dominoCsvStart);
            subgroupLatest++;
        }

        for (let i = subgroup; i < subgroupLatest; i++) {
            const dominoCsvEnd = {
                Timestamp: getFormattedTimeFromSeconds(domino.startSec + domino.durationSec),
                Event: "ES",
                Subgroup: i,
            };
            dominosCsvFormat.push(dominoCsvEnd);
        }

        subgroup = subgroupLatest;
    }
    return Papa.unparse(dominosCsvFormat);
}

export async function createDominosFromCsv(file) {
    const dominos = [];
    const lines = await readCsv(file);
    let openSGs = [];
    let timestamp = null;

    for (const line of lines) {
        const timestampSplit = line.Timestamp.split(':');
        if (timestampSplit.length < 2)
            continue;

        if (timestamp == null) { // first valid entry, but not necessarily on line 1 or 2 - rather the first valid line
            timestamp = line.Timestamp;
        } else if (timestamp !== line.Timestamp) { // new time slot, time to create a domino
            const startSec = getSecondsFromFormattedTime(timestamp);
            const durationSec = getSecondsFromFormattedTime(line.Timestamp) - startSec;
            const comment = openSGs.map(sg => sg.comment).filter(c => c !== "").join("\n") || "";
            const activePersons = _.spread(_.union)(openSGs.map(sg => sg.activePersons));
            const personToCoupling = getMergedCouplings(openSGs);
            const domino = new Domino(personToCoupling, { [0]: 0, [1]: 0, [2]: 1, [3]: 2 }, activePersons, startSec, durationSec, comment);

            dominos.push(domino);
            timestamp = line.Timestamp;
        }

        const subgroupId = line["Subgroup #"] || line.Subgroup;
        if (line.Event === 'NS') {
            const sg = {
                personToCoupling: [],
                activePersons: [],
                subgroup: subgroupId,
                comment: line.Comment,
            };
            const coupling = line.Coupling.replace(/[0-9]/g, "");

            for (let i = 0; i < 4; i++) {
                if (isPersonActive(i, line)) {
                    sg.activePersons.push(i);
                    sg.personToCoupling[i] = coupling;
                }
            }

            openSGs.push(sg);
        } else if (line.Event === 'ES') {
            openSGs = openSGs.filter(s => s.subgroup !== subgroupId);
        }
    }

    return dominos;
}

function getMergedCouplings(sgs) {
    const p2c = [];

    for (const sg of sgs) {
        for (const key in sg.personToCoupling) {
            p2c[key] = sg.personToCoupling[key];
        }
    }

    return p2c;
}

function isPersonActive(person, line) {
    const val = line['P' + (person + 1)];
    if (val && val !== '0')
        return true;

    // backwards compatibility of CSV (fixed room layout):
    if (person === 2)
        return line.R2 && line.R2 !== '0';
    if (person === 3)
        return line.R3 && line.R3 !== '0';

    return false;
}

export function readCsv(file) {
    return new Promise((resolve, reject) => {
        Papa.parse(file, {
            header: true,
            complete(results, file) {
                resolve(results.data);
            },
            error(err, file) {
                reject(err);
            }
        });
    });
}

export function download(filename, text) {
    var element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
    element.setAttribute('download', filename);

    element.style.display = 'none';
    document.body.appendChild(element);

    element.click();

    document.body.removeChild(element);
}