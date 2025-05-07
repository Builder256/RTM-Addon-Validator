// @ts-check
/**
 * @file index.js
 * @author Builder
 */

const fs = require('fs');
const path = require('path');
const unzipper = require('unzipper');
const iconv = require('iconv-lite');

const TARGET_DIR = './addon/';
const TARGET_FILE = '[RTM]kj_8800k.zip';

const fileTree = {};

function insertToTree(pathParts, node, fullPath, buffer) {
    const part = pathParts.shift();
    if (!part) return;

    if (pathParts.length === 0) {
        node[part] = {
            type: 'file',
            path: fullPath,
            getContent: async () => buffer,
            getTextContent: async (encoding = 'utf8') => {
                return iconv.decode(buffer, encoding);
            },
        };
    } else {
        if (!node[part]) node[part] = {};
        insertToTree(pathParts, node[part], fullPath, buffer);
    }
}

async function buildZipTree(zipPath) {
    const directory = await unzipper.Open.file(zipPath);
    for (const file of directory.files) {
        if (file.type === 'File') {
            const buffer = await file.buffer();
            const parts = file.path.split('/').filter(Boolean);
            insertToTree(parts, fileTree, file.path, buffer);
        }
    }
    return fileTree;
}

function findFiles(tree, predicate, currentPath = '') {
    const matches = [];

    for (const [name, value] of Object.entries(tree)) {
        const fullPath = currentPath ? `${currentPath}/${name}` : name;

        if (value.type === 'file') {
            if (predicate(name, fullPath, value)) {
                matches.push({ name, path: fullPath, node: value });
            }
        } else if (typeof value === 'object') {
            // 再帰探索
            matches.push(...findFiles(value, predicate, fullPath));
        }
    }

    return matches;
}

(async () => {
    const tree = await buildZipTree(path.join(TARGET_DIR, TARGET_FILE));
    const allZipPaths = new Set();

    // 全ファイルのパスを取得
    const allFiles = findFiles(tree, () => true);
    allFiles.forEach((file) => allZipPaths.add(file.path));

    const trainJsons = findFiles(tree, (name) => /^ModelTrain_.*\.json$/i.test(name));

    const modelFiles = [];

    for (const json of trainJsons) {
        const jsonText = await json.node.getTextContent('utf8');
        let jsonData;

        try {
            jsonData = JSON.parse(jsonText);
        } catch (e) {
            console.error(`Error parsing JSON from ${json.path}:`, e);
            continue;
        }

        if (!('trainModel2' in jsonData)) {
            // trainModel2が存在しない場合
            console.error(`No trainModel2 found in ${json.path}`);
        } else {
            // trainModel2が存在する場合

            // if (!('modelFile' in jsonData.trainModel2)) {
            //     // modelFileが存在しない場合
            //     console.error(`No modelFile found in ${json.path}`);
            // } else if (typeof jsonData.trainModel2.modelFile !== 'string') {
            //     // modelFileが文字列でない場合
            //     console.error(`modelFile is not a string in ${json.path}`);
            // } else if (jsonData.trainModel2.modelFile.length === 0) {
            //     // modelFileが空文字列の場合
            //     console.error(`modelFile is empty in ${json.path}`);
            // }

            modelFiles.push({
                reading: json.path,
                modelFile: jsonData.trainModel2.modelFile,
            });
        }

        // const trainModel = jsonData.trainModel2;
        // console.log(trainModel);
        // modelFiles.push({
        //     reading: json.path,
        //     modelFile: trainModel.modelFile,
        // });
    }

    console.log(modelFiles);

    // // 画像ファイルの保存
    // const imageBuf = await tree['images']['photo.jpg'].getContent();
    // fs.writeFileSync('output/photo.jpg', imageBuf);

    // // テキストファイルをShift-JISで読み取り
    // const sjisText = await tree['docs']['manual.txt'].getTextContent('shift_jis');
    // console.log(sjisText);

    // // JSONなどUTF-8で読む
    // const jsonText = await tree['data']['info.json'].getTextContent('utf8');
    // const json = JSON.parse(jsonText);
    // console.log(json);
})();
