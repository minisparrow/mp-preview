// 使用 require 导入 JSON 文件以避免 TypeScript 的 JSON 模块解析问题
const defaultTemplate = require('./default.json');
const minimalTemplate = require('./minimal.json');
const elegantTemplate = require('./elegant.json');
const darkTemplate = require('./dark.json');
const academicTemplate = require('./academic.json');
const yebanTemplate = require('./yeban.json');
const darkgreenTemplate = require('./darkgreen.json');

export const templates = {
    default: defaultTemplate,
    minimal: minimalTemplate,
    elegant: elegantTemplate,
    dark: darkTemplate,
    academic: academicTemplate,
    yeban: yebanTemplate,
    darkgreen: darkgreenTemplate
};