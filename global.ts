import { Client, Collection } from 'discord.js';

// * Global declarations, types declared in global.d.ts

Map.prototype.toArray = function() {
    return [...this.values()];
}

Map.prototype.toSet = function() {
    return new Set([...this.keys()]);
}

Array.prototype.split = function(chunks, balanced = true) {
    if (chunks < 2) return [this];
    let i = 0, size: number;
    const len = this.length, out = [];
    if ((len % chunks) === 0) {
        size = Math.floor(len / chunks);
        while (i < len) {
            out.push(this.slice(i, i += size));
        }
    } else if (balanced) {
        while (i < len) {
            size = Math.ceil((len - i) / chunks--);
            out.push(this.slice(i, i += size));
        }
    } else {
        chunks--;
        size = Math.floor(len / chunks);
        if ((len % size) === 0) size--;
        while (i < size * chunks) {
            out.push(this.slice(i, i += size));
        }
        out.push(this.slice(size * chunks));
    }
    return out;
}

Array.prototype.toMap = function(path) {
    const keyPath = path.split('.');
    return new Map(
        this.map(value => {
            let keyValue = value;
            for (const key of keyPath) {
                if (!keyValue) break;
                keyValue = keyValue[key];
            }
            return [keyValue, value];
        })
    );
}

Array.prototype.difference = function() {
    if (this.length < 2) return [];
    let values: number[] = [];
    for (let index = 0; index < this.length; index++) {
        if (!index) continue; 
        values.push(this[index] - this[index - 1]);
    }
    return values;
}

Array.prototype.toGenerator = function*() {
    let i = 0;
    while (true) {
        const value = (yield this[i]) || 1;
        i = (this.length + i + value) % this.length;
    }
}

Array.prototype.random = function() {
    const index = Math.floor(Math.random() * this.length);
    return this[index];
}

Array.prototype.lastIndex = function() {
    return this.length 
        ? this.length - 1 
        : this.length;
}

Array.prototype.last = function() {
    return this.length 
        ? this[this.lastIndex()]
        : undefined;
}

String.prototype.capitalize = function(options) {
    let string = this;
    if (!options?.preserve) string = string.toLowerCase();
    return string.charAt(0).toUpperCase() + string.substring(1);
}

const QUOTE = /['"`’]/;
const WORD = /[0-9a-zA-Z\u00C0-\u017F\u0400-\u04FF]/;

String.prototype.capitalizeWords = function(options) {
    let string = this;
    if (!options?.preserve) string = string.toLowerCase();
    let startOfWord = 0, match: RegExpExecArray, out = "", count = 0;
    const nonWord = /[^0-9a-zA-Z\u00C0-\u017F\u0400-\u04FF]+|$/g;
    while (match = nonWord.exec(string)) {
        if (startOfWord === string.length) break;
        const sep = match[0], sepStart = nonWord.lastIndex - sep.length;
        if ((!options?.capitalizeAfterQuote && QUOTE.test(string[sepStart])) && WORD.test(string[sepStart + 1])) continue;
        let word = string.substring(startOfWord, nonWord.lastIndex - sep.length);
        if (!options?.capitalizeAfterQuote && QUOTE.test(word[0])) {
            out += word[0];
            word = word.substring(1);
        }
        const skipWord = "skipWord" in options && options.skipWord(word, count);
        out += (skipWord ? word : word.capitalize(options)) + sep;
        startOfWord = nonWord.lastIndex;
        count++;
    }
    return out;
}

Math.percentage = function(value, of_value) {
    const decimal = value / of_value;
    return decimal * 100;
}

Math.difference = function(x, y) {
    return Math.sign(x) === Math.sign(y) 
        ? Math.abs(x - y)
        : Math.abs(x) + Math.abs(y);
}

const suffixes = ["", "k", "m", "b", "t", "q"];

Number.prototype.abbreviate = function(fractionDigits = 1) {
    type AbbrevationValue = string | number;
    let newValue: AbbrevationValue = this;
    if (this >= 1000) {
        const suffixNum = Math.floor(this.toString().length / 3);
        let shortValue: AbbrevationValue = '';
        for (let precision = 2; precision >= 1; precision--) {
            shortValue = parseFloat((suffixNum != 0 ? (this / Math.pow(1000, suffixNum)) : this).toPrecision(precision));
            const dotLessShortValue = shortValue.toString().replace(/[^a-zA-Z 0-9]+/g, '');
            if (dotLessShortValue.length <= 2) break;
        }
        if ((<number>shortValue % 1) != 0)  shortValue = (<number>shortValue).toFixed(fractionDigits);
        newValue = shortValue + suffixes[suffixNum];
    }
    return newValue as string;
}

Date.prototype.isValid = function() {
    const ms = this.getTime();
    return !isNaN(ms);
}

JSON.convertToCSV = function(array, seperator = "|") {
    let content = '';
    const keys = Object.keys(array[0]);
    content += keys.join(seperator) + '\r\n';
    for (let i = 0; i < array.length; i++) {
        let line = '';
        for (const key of keys) {
            if (line !== '') line += seperator;
            line += array[i][key];
        }
        content += line;
        if ((i + 1) !== array.length) content += '\r\n';
    }
    return content;
}

// * Discord declarations, types declared in global.d.ts

Client.prototype.chatCommands = new Collection();
Client.prototype.menuCommands = new Collection();
Client.prototype.components = new Collection();
Client.prototype.cooldowns = new Collection();