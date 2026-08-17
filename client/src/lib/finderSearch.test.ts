import { describe, expect, it } from "vitest";
import { searchVirtualFiles } from "./finderSearch";

const home = "/Users/freshdesk";
const files = [
  `${home}/README.md`,
  `${home}/Downloads/阅读-example.txt`,
  `${home}/Downloads/发票.pdf`,
  `${home}/Pictures/晨雾极光.jpg`,
];

describe("searchVirtualFiles", () => {
  it("按当前目录范围筛选匹配的文件", () => {
    expect(searchVirtualFiles({ files, home, currentPath: home, scope: "current", query: "readme" })).toEqual([`${home}/README.md`]);
  });

  it("只在指定 Downloads 或 Pictures 目录中搜索", () => {
    expect(searchVirtualFiles({ files, home, currentPath: home, scope: "downloads", query: "阅读" })).toEqual([`${home}/Downloads/阅读-example.txt`]);
    expect(searchVirtualFiles({ files, home, currentPath: home, scope: "pictures", query: "极光" })).toEqual([`${home}/Pictures/晨雾极光.jpg`]);
  });
});
