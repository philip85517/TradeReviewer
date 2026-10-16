#!/usr/bin/env node
"use strict";

// Minimal, dependency-free behavior regression for review-client.js.
// It evaluates the real client IIFE against a tiny DOM/event seam and drives
// selectionchange, open, input, save, and a second selection through handlers.

import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import path from "node:path";

const defaultClientPath = "../../docs/design-system/baselines/2026-10-15-homepage-v1.0/review-client.js";
const clientPath = path.resolve(path.dirname(new URL(import.meta.url).pathname), process.env.REVIEW_CLIENT_PATH || defaultClientPath);
const clientSource = fs.readFileSync(clientPath, "utf8");

class EventTarget {
  constructor() { this.listeners = new Map(); }
  addEventListener(type, listener) { const list = this.listeners.get(type) || []; list.push(listener); this.listeners.set(type, list); }
  dispatchEvent(event) {
    event.target ||= this;
    for (const listener of this.listeners.get(event.type) || []) listener.call(this, event);
    return !event.defaultPrevented;
  }
}

class Element extends EventTarget {
  constructor(tagName, ownerDocument) {
    super();
    this.ownerDocument = ownerDocument;
    this.tagName = tagName.toUpperCase();
    this.children = [];
    this.parentNode = null;
    this.dataset = {};
    this.attributes = {};
    this.style = {};
    this.className = "";
    this.classList = {
      add: (...names) => names.forEach((name) => { if (!this.className.split(/\s+/).includes(name)) this.className = `${this.className} ${name}`.trim(); }),
      remove: (...names) => { this.className = this.className.split(/\s+/).filter((name) => name && !names.includes(name)).join(" "); },
      contains: (name) => this.className.split(/\s+/).includes(name),
    };
    this.value = "";
    this.readOnly = false;
    this.textContent = "";
    this.disabled = false;
    this.inert = false;
    this.hidden = false;
    this.offsetParent = this;
  }
  set id(value) { this.attributes.id = String(value); }
  get id() { return this.attributes.id || ""; }
  set innerHTML(value) {
    this._innerHTML = String(value);
    this.textContent = this._innerHTML.replace(/<[^>]*>/g, "").replace(/&quot;/g, '"').replace(/&amp;/g, "&").trim();
    this.children = [];
    // The production panel is generated as one template string. Parse only
    // its stable control IDs/classes; all event handlers remain production code.
    const idPattern = /(?:id|data-export)="([^"]+)"/g;
    let match;
    while ((match = idPattern.exec(this._innerHTML))) {
      const node = new Element(match[0].startsWith("data-") ? "a" : "div", this.ownerDocument);
      if (match[0].startsWith("data-")) node.dataset.export = match[1]; else node.id = match[1];
      this.appendChild(node);
    }
    const classPattern = /class="([^"]+)"/g;
    while ((match = classPattern.exec(this._innerHTML))) {
      const node = new Element("div", this.ownerDocument);
      node.className = match[1];
      this.appendChild(node);
    }
    for (const className of ["review-close", "review-cancel", "review-save", "review-refresh"]) {
      if (this._innerHTML.includes(`class="${className}"`)) { const node = new Element("button", this.ownerDocument); node.className = className; this.appendChild(node); }
    }
    for (const id of ["review-name", "review-role", "review-opinion", "review-filter"]) {
      if (this._innerHTML.includes(`id="${id}"`)) { const node = new Element(id === "review-opinion" ? "textarea" : "input", this.ownerDocument); node.id = id; this.appendChild(node); }
    }
  }
  get innerHTML() { return this._innerHTML || ""; }
  append(...children) { children.forEach((child) => this.appendChild(child)); }
  appendChild(child) { child.parentNode = this; this.children.push(child); if (!this._innerHTML && child.textContent) this.textContent += child.textContent; return child; }
  prepend(child) { child.parentNode = this; this.children.unshift(child); return child; }
  remove() { if (this.parentNode) this.parentNode.children = this.parentNode.children.filter((child) => child !== this); }
  contains(node) { return node === this || this.children.some((child) => child.contains(node)); }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  getAttribute(name) { return this.attributes[name] ?? null; }
  focus() { this.ownerDocument.activeElement = this; }
  scrollIntoView() {}
  closest(selector) {
    let node = this;
    while (node) { if (matches(node, selector)) return node; node = node.parentNode; }
    return null;
  }
  querySelector(selector) { return find(this, selector)[0] || null; }
  querySelectorAll(selector) { return find(this, selector); }
}

function matches(node, selector) {
  if (selector.startsWith("#")) return node.id === selector.slice(1);
  if (selector.startsWith(".")) return node.classList.contains(selector.slice(1));
  const data = selector.match(/^\[data-([\w-]+)(?:="([^"]*)")?\]$/);
  if (data) return node.dataset[data[1].replace(/-([a-z])/g, (_, c) => c.toUpperCase())] !== undefined && (data[2] === undefined || node.dataset[data[1].replace(/-([a-z])/g, (_, c) => c.toUpperCase())] === data[2]);
  if (selector === "button") return node.tagName === "BUTTON";
  if (selector === "input") return node.tagName === "INPUT";
  if (selector === "select") return node.tagName === "SELECT";
  if (selector === "textarea") return node.tagName === "TEXTAREA";
  if (selector === "a[href]") return node.tagName === "A" && node.getAttribute("href");
  const taggedData = selector.match(/^([a-z]+)\[data-([\w-]+)(?:="([^"]*)")?\]$/i);
  if (taggedData) {
    const key = taggedData[2].replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    return node.tagName === taggedData[1].toUpperCase() && node.dataset[key] !== undefined && (taggedData[3] === undefined || node.dataset[key] === taggedData[3]);
  }
  if (/^[a-z]+$/i.test(selector)) return node.tagName === selector.toUpperCase();
  if (selector.includes(":")) return matches(node, selector.split(":")[0]);
  return false;
}

function find(root, selector) {
  const results = [];
  const visit = (node) => { if (matches(node, selector)) results.push(node); node.children.forEach(visit); };
  root.children.forEach(visit);
  return results;
}

class Range {
  constructor() { this.block = null; this.startContainer = null; this.endContainer = null; this.startOffset = 0; this.endOffset = 0; }
  selectNodeContents(block) { this.block = block; this.startContainer = block; this.endContainer = block; }
  setStart(container, offset) { this.startContainer = container; this.startOffset = offset; }
  setEnd(container, offset) { this.endContainer = container; this.endOffset = offset; }
  setStartBefore(block) { this.block = block; this.startContainer = block; this.startOffset = 0; }
  setEndAfter(block) { this.block = block; this.endContainer = block; this.endOffset = block.textContent.length; }
  compareBoundaryPoints(which) { return which === Range.START_TO_END ? 1 : -1; }
  intersectsNode(block) { return block === this.block; }
  cloneContents() { const fragment = new Element("fragment", this.block?.ownerDocument); fragment.textContent = this.block?.textContent || ""; return fragment; }
}
Range.START_TO_END = 1;
Range.END_TO_START = 2;

class Document extends EventTarget {
  constructor() { super(); this.body = new Element("body", this); this.activeElement = null; }
  createElement(tagName) { return new Element(tagName, this); }
  createRange() { return new Range(); }
  querySelector(selector) { return this.body.querySelector(selector); }
  querySelectorAll(selector) { return this.body.querySelectorAll(selector); }
}

function makeEvent(type, detail = {}) { return { type, ...detail, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; } }; }
function flush() { return new Promise((resolve) => setImmediate(resolve)); }

async function run() {
  const document = new Document();
  const main = document.createElement("main"); main.id = "reader-document"; main.dataset.documentId = "DOC-21"; main.dataset.documentVersion = "2.1"; main.dataset.documentFingerprint = "fp-21";
  const blockA = document.createElement("p"); blockA.dataset.commentBlock = "BT02-A"; blockA.dataset.chapter = "BT02"; blockA.textContent = "第一段原文 A";
  const blockB = document.createElement("p"); blockB.dataset.commentBlock = "BT03-B"; blockB.dataset.chapter = "BT03"; blockB.textContent = "第二段原文 B";
  const blockC = document.createElement("p"); blockC.dataset.commentBlock = "BT04-C"; blockC.dataset.chapter = "BT04"; blockC.textContent = "第三段原文 C";
  const blockD = document.createElement("p"); blockD.dataset.commentBlock = "BT05-D"; blockD.dataset.chapter = "BT05"; blockD.textContent = "第四段原文 D";
  const figure = document.createElement("figure");
  const image = document.createElement("img"); image.dataset.commentImage = "IMG-01"; image.dataset.commentOccurrence = "IMG-01@1"; image.setAttribute("src", "/img-01.png");
  figure.appendChild(image);
  main.appendChild(blockA); main.appendChild(blockB); main.appendChild(blockC); main.appendChild(blockD); main.appendChild(figure);
  const openButton = document.createElement("button"); openButton.id = "review-open"; openButton.textContent = "评论";
  const manifest = document.createElement("script"); manifest.id = "document-manifest"; manifest.textContent = JSON.stringify({ documentId: "DOC-21", version: "2.1", fingerprint: "fp-21" });
  document.body.appendChild(main); document.body.appendChild(openButton); document.body.appendChild(manifest);

  let selectedBlock = null;
  const selection = { rangeCount: 1, isCollapsed: false, getRangeAt: () => { const range = new Range(); range.block = selectedBlock; range.commonAncestorContainer = selectedBlock; range.startContainer = selectedBlock; range.endContainer = selectedBlock; return range; } };
  const posts = [];
  const acceptedPosts = [];
  let postMode = "success";
  let deferNextPost = false;
  let resolveDeferredPost = null;
  const responseFor = () => ({ ok: true, status: 200, json: async () => ({ revision: acceptedPosts.length, comments: acceptedPosts.map((entry, index) => ({ id: `comment-${index + 1}`, status: "pending-review", ...entry.payload })) }) });
  const context = {
    document,
    window: { innerWidth: 1440, scrollY: 0, scrollX: 0, getSelection: () => selection, scrollTo() {}, setTimeout },
    NodeFilter: { SHOW_TEXT: 4, FILTER_REJECT: 2, FILTER_ACCEPT: 1 },
    CSS: { escape: (value) => String(value) },
    Range,
    fetch: async (url, options = {}) => {
      if (options.method === "POST") {
        const body = JSON.parse(options.body); posts.push(body);
        const response = () => { if (postMode === "fail") return { ok: false, status: 503, json: async () => ({ error: { message: "offline" } }) }; acceptedPosts.push(body); return responseFor(); };
        if (deferNextPost) { deferNextPost = false; return new Promise((resolve) => { resolveDeferredPost = () => resolve(response()); }); }
        return response();
      }
      if (url.startsWith("/api/documents")) return { ok: true, status: 200, json: async () => ({ documents: [] }) };
      return responseFor();
    },
    console,
  };
  vm.runInNewContext(clientSource, context, { filename: clientPath });

  const select = async (block) => { selectedBlock = block; document.dispatchEvent(makeEvent("selectionchange")); await flush(); };
  const click = async (node) => { node.dispatchEvent(makeEvent("click")); await flush(); await flush(); };
  let panel = null;
  const save = async (opinion) => { panel.querySelector("#review-opinion").value = opinion; await click(panel.querySelector(".review-save")); };
  const openText = async (block) => { await select(block); await click(openButton); panel ||= document.querySelector("#review-panel"); assert.match(panel.querySelector(".review-selection").innerHTML, new RegExp(block.textContent), `editor should show ${block.textContent}`); };
  const cancel = async () => click(panel.querySelector(".review-cancel"));
  await openText(blockA);
  panel.querySelector("#review-name").value = "测试评论者";
  panel.querySelector("#review-role").value = "commenter";

  // Three sequential saves must each carry its own quote and operation.
  await save("意见 A");
  assert.equal(posts.length, 1, "first save should create exactly one request");
  assert.equal(posts[0].payload.segments[0].quote, "第一段原文 A");
  const firstOperationId = posts[0].operationId;
  panel.querySelector("#review-opinion").value = "A补充草稿";
  await click(panel.querySelector(".review-close"));
  await select(blockB); await click(openButton);
  assert.match(panel.querySelector(".review-selection").innerHTML, /第一段原文 A/, "a draft entered after save must retain A when reopened");
  assert.equal(panel.querySelector("#review-opinion").value, "A补充草稿");
  await cancel();
  await select(blockB);
  assert.match(panel.querySelector(".review-selection").innerHTML, /第二段原文 B/, "visible clean panel should follow a new selection without reopening");
  assert.equal(panel.querySelector(".review-status").textContent, "已选新原文，请写下意见。", "new selection should clear the prior saved status");
  await save("意见 B");
  await openText(blockC); await save("意见 C");
  assert.deepEqual(posts.slice(0, 3).map((entry) => entry.payload.segments[0].quote), ["第一段原文 A", "第二段原文 B", "第三段原文 C"]);
  assert.equal(new Set(posts.slice(0, 3).map((entry) => entry.operationId)).size, 3, "sequential saves need independent operations");

  // The reported regression: a clean open editor must adopt the new native selection.
  await openText(blockB);
  await select(blockD);
  await click(openButton);
  const visibleQuote = panel.querySelector(".review-selection").innerHTML;
  assert.match(visibleQuote, /第四段原文 D/, "reopening a clean editor should show the newly selected D quote");
  assert.doesNotMatch(visibleQuote, /第二段原文 B/, "new selection must not retain the prior B quote");
  assert.equal(panel.querySelector("#review-opinion").value, "", "new selection should start with an empty editor");
  await save("意见 D");

  // A closed clean panel can bind the next selection; a nonempty draft remains frozen.
  await openText(blockC); await cancel();
  await select(blockA); await click(openButton);
  assert.match(panel.querySelector(".review-selection").innerHTML, /第一段原文 A/, "reopen after cancel should use the new selection");
  assert.equal(panel.querySelector("#review-opinion").value, "");
  await cancel();
  await openText(blockB); panel.querySelector("#review-opinion").value = "未保存意见"; await click(panel.querySelector(".review-close"));
  const closedDraftImageButton = figure.querySelector(".image-comment-button");
  await click(closedDraftImageButton);
  assert.match(panel.querySelector(".review-selection").innerHTML, /第二段原文 B/, "closing a draft must retain its original quote");
  assert.equal(panel.querySelector("#review-opinion").value, "未保存意见", "closing a draft must retain its opinion");
  assert.equal(panel.querySelector(".review-status").textContent, "请先保存或取消当前评论。", "protected image action should explain why the draft stays open");
  await cancel();

  // An image action cannot silently discard a text draft or pending request.
  const imageButton = figure.querySelector(".image-comment-button");
  await openText(blockA); panel.querySelector("#review-opinion").value = "图前文本草稿"; await click(imageButton);
  assert.match(panel.querySelector(".review-selection").innerHTML, /第一段原文 A/, "image action must not replace a text draft");
  assert.equal(panel.querySelector("#review-opinion").value, "图前文本草稿");
  await cancel();
  await click(imageButton); assert.match(panel.querySelector(".review-selection").innerHTML, /IMG-01/, "clean image action should open the image editor"); await save("图片意见");
  assert.equal(posts.at(-1).payload.image.id, "IMG-01");
  assert.deepEqual(posts.at(-1).payload.segments, []);

  // Explicitly recommenting the same quote creates a separate operation.
  await openText(blockA); await save("意见 A2");
  assert.equal(posts.at(-1).payload.segments[0].quote, "第一段原文 A");
  assert.notEqual(posts.at(-1).operationId, firstOperationId, "same quote explicit submit needs a new operation");

  // Failure keeps an immutable request and draft; selection/image actions cannot cancel it.
  await openText(blockB); panel.querySelector("#review-opinion").value = "失败草稿"; postMode = "fail";
  await click(panel.querySelector(".review-save"));
  assert.equal(panel.querySelector("#review-opinion").readOnly, false, "opinion must be editable after a failed save");
  const failed = posts.at(-1); const failedCount = posts.length;
  panel.querySelector("#review-opinion").value = "修改后的意见";
  await click(panel.querySelector(".review-save"));
  assert.equal(posts.length, failedCount, "editing a failed pending opinion must not issue a new request");
  assert.equal(panel.querySelector("#review-opinion").value, "修改后的意见", "edited failed input must remain visible");
  assert.equal(panel.querySelector(".review-status").textContent, "当前草稿已修改，请恢复原意见后重试，或取消后重新评论。", "edited failed input should explain the retry guard");
  panel.querySelector("#review-opinion").value = failed.payload.opinion;
  await click(panel.querySelector(".review-close")); await select(blockC); await click(openButton);
  assert.match(panel.querySelector(".review-selection").innerHTML, /第二段原文 B/, "failed request must retain its quote");
  assert.equal(panel.querySelector("#review-opinion").value, "失败草稿");
  await click(imageButton); assert.equal(posts.length, failedCount, "image action must not cancel a failed request");
  postMode = "success"; await click(panel.querySelector(".review-save"));
  assert.equal(posts.at(-1).operationId, failed.operationId, "retry must reuse the failed operation ID");
  assert.equal(posts.at(-1).payload.segments[0].quote, failed.payload.segments[0].quote, "retry must reuse the failed quote");

  // Double-clicking while the request is in flight must still issue one POST.
  await openText(blockC); panel.querySelector("#review-opinion").value = "网络中评论"; deferNextPost = true;
  const beforeInFlight = posts.length; const saveButton = panel.querySelector(".review-save");
  saveButton.dispatchEvent(makeEvent("click")); await flush(); saveButton.dispatchEvent(makeEvent("click")); await flush();
  assert.equal(posts.length, beforeInFlight + 1, "duplicate click during in-flight save must issue one request");
  assert.equal(panel.querySelector("#review-opinion").readOnly, true, "opinion must be read-only during an in-flight save");
  assert.equal(panel.querySelector(".review-selection").innerHTML.includes("第三段原文 C"), true, "in-flight save must retain its quote");
  resolveDeferredPost?.(); await flush(); await flush();
  assert.equal(panel.querySelector("#review-opinion").readOnly, false, "opinion must be editable after a successful save");
  assert.equal(posts.at(-1).payload.segments[0].quote, "第三段原文 C");
  console.log(`PASS continuous save selection lifecycle (${posts.length} POST attempts)`);
}

run().catch((error) => { console.error(`FAIL ${error.message}`); process.exitCode = 1; });
