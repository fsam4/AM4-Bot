import { Client, Collection } from 'discord.js';

// * Global declarations, types declared in global.d.ts

Map.prototype.toArray = function() {
    return Array.from(this.values());
}

Map.prototype.toSet = function() {
    const array = Array.from(this);
    const keys = array.map(arr => arr[0]);
    return new Set([...keys]);
}

Array.prototype.split = function(chunks, balanced = true) {
    if (chunks < 2) return [this];
    let len = this.length, out = [], i = 0, size: number;
    if (len % chunks === 0) {
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
        if (len % size === 0) size--;
        while (i < size * chunks) {
            out.push(this.slice(i, i += size));
        }
        out.push(this.slice(size * chunks));
    }
    return out;
}

Array.prototype.toMap = function(path) {
    const props = path.split('.');
    const values: Array<[any, any]> = this.map(value => {
        let key = value;
        for (const prop of props) key = key[prop];
        return [key, value];
    });
    return new Map(values);
}

Array.prototype.difference = function() {
    if (this.length === 1) return [];
    let values: number[] = [], index = 0;
    while (index < this.length) {
        if (index) values.push(this[index] - this[index - 1]);
        index++;
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

Array.prototype.last = function() {
    return this[this.length - 1];
}

String.prototype.capitalize = function() {
    const words = this.split(" ").map(string => {
        const parts = string.split("'").map(string => {
            const letter = string.charAt(0).toUpperCase();
            const word = letter + string.slice(1);
            return word;
        });
        return parts.join("'");
    });
    return words.join(" ");
}

Math.percentage = function(value, of_value) {
    const decimal = value / of_value;
    return decimal * 100;
}

Math.difference = function(x, y) {
    if (Math.sign(x) === Math.sign(y)) {
        return Math.abs(x - y);
    } else {
        return Math.abs(x) + Math.abs(y);
    };
}

Number.prototype.abbreviate = function(fractionDigits = 1) {
    let newValue: string | number = this;
    if (this >= 1000) {
        let suffixes = ["", "k", "m", "b", "t"];
        let suffixNum = Math.floor(this.toString().length / 3);
        let shortValue: string | number = '';
        for (let precision = 2; precision >= 1; precision--) {
            shortValue = parseFloat((suffixNum != 0 ? (this / Math.pow(1000, suffixNum)) : this).toPrecision(precision));
            let dotLessShortValue = (shortValue + '').replace(/[^a-zA-Z 0-9]+/g, '');
            if (dotLessShortValue.length <= 2) break;
        }
        if (<number>shortValue % 1 != 0)  shortValue = (<number>shortValue).toFixed(fractionDigits);
        newValue = shortValue + suffixes[suffixNum];
    }
    return newValue as string;
}

Date.prototype.isValid = function() {
    const ms = this.getTime();
    return !isNaN(ms);
}

// * Discord declarations, types declared in global.d.ts

Client.prototype.chatCommands = new Collection();
Client.prototype.menuCommands = new Collection();
Client.prototype.components = new Collection();
Client.prototype.cooldowns = new Collection();