"use strict";

/**
 * The only bridge between the renderer and the main process.
 *
 * The renderer gets named operations, never Node. Paths come from the OS via
 * webUtils for drag-and-drop; everything else goes through ipcRenderer.invoke.
 */

const { contextBridge, ipcRenderer, webUtils } = require("electron");

const call = (channel, payload) => ipcRenderer.invoke(channel, payload);

contextBridge.exposeInMainWorld("warboardBox", {
  state: () => call("state:get"),
  meta: () => call("app:meta"),
  saveConfig: (patch) => call("config:save", patch),

  createWarboard: (title) => call("warboard:create", { title }),
  getWarboard: (id) => call("warboard:get", { id }),
  saveNotes: (id, text) => call("warboard:notes", { id, text }),
  addPaths: (id, paths) => call("warboard:addPaths", { id, paths }),
  removeAttachment: (id, name) => call("warboard:removeAttachment", { id, name }),
  convertWarboard: (id) => call("warboard:convert", { id }),

  getDeck: (id) => call("deck:get", { id }),
  writeDeckFile: (id, name, content) => call("deck:write", { id, name, content }),
  confirmDeck: (id) => call("deck:confirm", { id }),
  unlockDeck: (id) => call("deck:unlock", { id }),
  deleteDeck: (id) => call("deck:delete", { id }),

  setBoxTarget: (target) => call("box:setTarget", { target }),
  sealBox: () => call("box:seal"),
  unsealBox: () => call("box:unseal"),
  shipBox: (nextTarget) => call("box:ship", { nextTarget }),

  pickFiles: () => call("dialog:pickFiles"),
  pickDataRoot: () => call("dialog:pickDataRoot"),
  openDocs: () => call("dialog:pickDocs"),
  openPath: (target) => call("shell:openPath", { target }),
  deckFolder: (id) => call("folder:deck", { id }),
  warboardFolder: (id) => call("folder:warboard", { id }),
  shippedFolder: (name) => call("folder:shipped", { name }),

  remoteStatus: () => call("remote:status"),
  remoteStart: () => call("remote:start"),
  remoteStop: () => call("remote:stop"),

  recentActivity: () => call("activity:recent"),

  /** Map dropped File objects to absolute OS paths (Electron webUtils). */
  pathsFromFiles: (files) => {
    const out = [];
    for (const file of Array.from(files || [])) {
      try {
        const filePath = webUtils.getPathForFile(file);
        if (filePath) out.push(filePath);
      } catch {
        // A File without a path (e.g. pasted text) is simply skipped.
      }
    }
    return out;
  },
});
