// @ts-check
/**
 * @file index.js
 * @author Builder
 */
// const fs = require('fs');
const path = require('path');
const unzipper = require('unzipper');
const iconv = require('iconv-lite');

const TARGET_DIR = './addon/';
const TARGET_FILE = '[RTM]kj_8800k.zip';

const fileTree = {};

/**
 * Inserts a file or directory into the file tree structure.
 * @param {string[]} pathParts - The parts of the file path split by '/'.
 * @param {Object} node - The current node in the file tree.
 * @param {string} fullPath - The full path of the file.
 * @param {Buffer} buffer - The file content as a buffer.
 */
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

/**
 * Builds a file tree from a ZIP archive.
 * @param {string} zipPath - The path to the ZIP file.
 * @returns {Promise<Object>} A promise that resolves to the file tree object.
 */
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

/**
 * Recursively finds files in the file tree that match a given predicate.
 * @param {Object} tree - The file tree to search.
 * @param {function(string, string, Object): boolean} predicate - A function to test each file.
 * @param {string} [currentPath=''] - The current path in the tree.
 * @returns {Array<{name: string, path: string, node: Object}>} An array of matching files.
 */
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

async function getJsonValues(json) {
    const jsonText = await json.node.getTextContent('utf8');
    let jsonData;

    try {
        jsonData = JSON.parse(jsonText);
    } catch (e) {
        return null;
    }

    const trainFiles = {
        model: jsonData.trainModel2.modelFile,
        textures: jsonData.trainModel2.textures,
        renderScript: jsonData.trainModel2.rendererPath,
    };

    const bogieFiles = [];
    // 二種類の台車指定のどちらにも対応

    if (jsonData.bogieModel2) {
        bogieFiles.push({
            model: jsonData.bogieModel2.modelFile,
            textures: jsonData.bogieModel2.textures,
            renderScript: jsonData.bogieModel2.rendererPath,
        });
    }

    if (Array.isArray(jsonData.bogieModel3)) {
        jsonData.bogieModel3.forEach((bogie) => {
            bogieFiles.push({
                model: bogie.modelFile,
                textures: bogie.textures,
                renderScript: bogie.rendererPath,
            });
        });
    }

    // console.log('Bogie Files:', bogieFiles);

    const buttonTexture = jsonData.buttonTexture;
    const rollsignTexture = jsonData.rollsignTexture;

    const serverScriptPath = jsonData.serverScriptPath;
    const soundScriptPath = jsonData.soundScriptPath;

    const seatPos = jsonData.seatPos;
    const slotPos = jsonData.slotPos;
    const seatPosF = jsonData.seatPosF;

    return {
        trainFiles,
        bogieFiles,
        buttonTexture,
        rollsignTexture,
        serverScriptPath,
        soundScriptPath,
        seatPos,
        slotPos,
        seatPosF,
    };
}

/**
 * Main function to process the ZIP file and validate its contents.
 */
(async () => {
    const tree = await buildZipTree(path.join(TARGET_DIR, TARGET_FILE));
    const allZipPaths = new Set();
    // console.log(JSON.stringify(tree, null, 2));

    // 発生したエラーを格納する配列
    const errorMessages = [];

    // 全ファイルのパスを取得
    const allFiles = findFiles(tree, () => true);
    allFiles.forEach((file) => allZipPaths.add(file.path));
    // console.log(allZipPaths);

    const trainJsons = findFiles(tree, (name) => /^ModelTrain_.*\.json$/i.test(name)); // ModelTrain_で始まるJSONファイルを取得
    if (trainJsons.length === 0) {
        errorMessages.push('JSONファイルが見つかりません。ModelTrain_で始まるJSONファイルを確認してください。');
    }

    const modelFileList = new Set();
    const textureFileList = new Set();
    const scriptFileList = new Set();

    for (const json of trainJsons) {
        // console.log(`Processing ${json.path}`);
        const values = await getJsonValues(json);
        if (!values) {
            errorMessages.push(`JSON:${json.path}の解析に失敗しました。文法が不正である可能性があります。`);
            continue;
        }
        const { trainFiles, bogieFiles, buttonTexture, rollsignTexture, serverScriptPath, soundScriptPath, seatPos, slotPos, seatPosF } = values;

        console.log(`JSON:${json.path}の解析が完了しました。`);
        // console.log(
        //     JSON.stringify(
        //         trainFiles.textures.map((texture) => texture[1]),
        //         null,
        //         2
        //     )
        // );

        if (trainFiles) {
            modelFileList.add(trainFiles.model);
            trainFiles.textures.forEach((texture) => {
                if (texture[1]) {
                    textureFileList.add(texture[1]); // テクスチャパスだけを抜き出して追加
                }
            });
            if (trainFiles.renderScript) scriptFileList.add(trainFiles.renderScript);
        } else {
            errorMessages.push(`JSON:${json.path}で、"trainModel2"が適切に設定されていません。`);
        }

        if (bogieFiles) {
            bogieFiles.forEach((bogie) => {
                modelFileList.add(bogie.model);
                bogie.textures.forEach((texture) => {
                    if (texture[1]) {
                        textureFileList.add(texture[1]);
                    }
                });
                if (bogie.renderScript) scriptFileList.add(bogie.renderScript);
            });
        } else {
            errorMessages.push(`JSON:${json.path}で、"bogieModel2"または"bogieModel3"が適切に設定されていません。`);
        }

        if (buttonTexture) textureFileList.add(buttonTexture);
        else {
            errorMessages.push(`JSON:${json.path}で、"buttonTexture"が適切に設定されていません。`);
        }

        if (rollsignTexture) textureFileList.add(rollsignTexture);
        else {
            errorMessages.push(`JSON:${json.path}で、"rollsignTexture"が適切に設定されていません。`);
        }

        if (serverScriptPath) scriptFileList.add(serverScriptPath);

        if (soundScriptPath) scriptFileList.add(soundScriptPath);

        if (seatPos) {
            if (slotPos || seatPosF) {
                errorMessages.push(`JSON:${json.path}で、"seatPos"と"slotPos"/"seatPosF"が同時に設定されています。設定はどちらか一方にしてください。`);
            } else {
            }
        } else if (slotPos && seatPosF) {
        } else {
            errorMessages.push(`JSON:${json.path}で、座席設定が正しく設定されていません。"seatPos"のみ、または"slotPos"と"seatPosF"の両方を設定してください。`);
        }
    }

    // console.log('Model Files:\n\t', Array.from(modelFileList).join(', \n\t'), '\n');
    // console.log('Texture Files:\n\t', Array.from(textureFileList).join(', \n\t'), '\n');
    // console.log('Script Files:\n\t', Array.from(scriptFileList).join(', \n\t'), '\n');

    // 取得したファイルが実際に存在するか確認する
    const checkFileExist = (filePath) => {
        if (!allZipPaths.has(filePath)) {
            errorMessages.push(`ファイル:${filePath}がZIP内に存在しません。`);
        }
    };

    modelFileList.forEach((file) => checkFileExist('assets/minecraft/models/' + file));
    textureFileList.forEach((file) => checkFileExist('assets/minecraft/' + file));
    scriptFileList.forEach((file) => checkFileExist('assets/minecraft/' + file));
    console.info('全てのファイルの存在確認が完了しました。');

    if (errorMessages.length === 0) {
        console.log('全てのJSONファイルの解析が完了しました。問題はありません。');
    } else {
        console.log('エラーが発生しました。詳細は下記を確認してください。');
        console.error(errorMessages.join('\n'));
    }

    // 以下関数の使い方説明
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
