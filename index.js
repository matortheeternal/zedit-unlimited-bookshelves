/* global ngapp, xelib, registerPatcher, patcherUrl, patcherPath */

let signaturesToPatch = ['ALCH','BOOK','KEYM','MISC','SCRL','ARMO','WEAP'],
    objectBounds = ['X1', 'Y1', 'Z1', 'X2', 'Y2', 'Z2'];

let allReferencesFound = function(refRecords, knownModels) {
    return knownModels.reduce((b, model) => {
        return b && refRecords.hasOwnProperty(model);
    }, true);
};

let findReferenceRecords = function(refRecords, knownModels, file) {
    for (let signature of signaturesToPatch) {
        if (allReferencesFound(refRecords, knownModels)) return;
        let records = xelib.GetRecords(file, signature);
        records.forEach(record => {
            let model = xelib.GetValue(record, 'Model\\MODL');
            if (!knownModels.includes(model)) return;
            if (refRecords.hasOwnProperty(model)) return;
            refRecords[model] = record;
        });
    }
};

let allObjectBoundsZero = function(record) {
    return objectBounds.reduce((b, key) => {
        return b && xelib.GetValue(record, `OBND\\${key}`) === '0';
    }, true)
};

let getUnofficialPatchName = function() {
    return {
        TES5: 'Unofficial Skyrim Legendary Edition Patch.esp',
        SSE: 'Unofficial Skyrim Special Edition Patch.esp'
    }[xelib.GetGlobal('AppName')];
};

let loadKnownModels = function() {
    return fh.loadJsonFile(`${patcherPath}/knownModels.json`) || [];
};

registerPatcher({
    info: info,
    gameModes: [xelib.gmSSE, xelib.gmTES5],
    settings: {
        hide: true,
        label: 'Unlimited Bookshelves Patcher',
        defaultSettings: {
            ignoredFiles: [
                'Skyrim.esm', 'Update.esm', 'Dawnguard.esm',
                'HearthFires.esm', 'Dragonborn.esm'
            ]
        }
    },
    requiredFiles: ['UnlimitedBookshelves.esp'],
    execute: (patchFile, helpers, settings, locals) => ({
        initialize: function() {
            let knownModels = loadKnownModels(),
                refRecords = locals.referenceRecords = {};
            let referenceFiles = [
                xelib.FileByName('UnlimitedBookshelves.esp'),
                xelib.FileByName(getUnofficialPatchName()),
                xelib.FileByName('Skyrim.esm'),
            ];
            for (let file of referenceFiles) {
                if (allReferencesFound(refRecords, knownModels)) return;
                findReferenceRecords(refRecords, knownModels, file);
            }
        },
        process: signaturesToPatch.map(signature => ({
            load: {
                signature: signature,
                filter: function(record) {
                    let model = xelib.GetValue(record, 'Model\\MODL');
                    return locals.referenceRecords.hasOwnProperty(model) &&
                        allObjectBoundsZero(record);
                }
            },
            patch: function(record) {
                let model = xelib.GetValue(record, 'Model\\MODL'),
                    refRecord = locals.referenceRecords[model];
                xelib.SetElement(
                    xelib.GetElement(record, 'OBND'),
                    xelib.GetElement(refRecord, 'OBND')
                );
            }
        }))
    })
});