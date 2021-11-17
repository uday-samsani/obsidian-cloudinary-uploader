import {
  Notice,
  Plugin,
  MarkdownView,
  Editor,
} from "obsidian";

import axios from "axios"
import objectPath from 'object-path'
import CloudinaryUploaderSettingTab from './settings-tab'
interface CloudinarySettings {
  cloudName: string;
  uploadPreset: string;
  folder: string;
  //maxWidth: number; TODO
  // enableResize: boolean; TODO
}

const DEFAULT_SETTINGS: CloudinarySettings = {
  cloudName: null,
  uploadPreset: null,
  folder: null,
  //maxWidth: 4096, TODO
  //enableResize: false, TODO later
};

export default class CloudinaryUploader extends Plugin {
  settings: CloudinarySettings;

  private getEditor() {
    const mdView = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (mdView) {
      return mdView.editor;
    } else {
      return null;
    }
  }

  setupPasteHandler(): void {
    this.registerCodeMirror((cm: any) => {
      cm._handlers.paste[0] = async (_: any, e: ClipboardEvent) => {
        const { files } = e.clipboardData;
        if (files.length == 0 || !files[0].type.startsWith("image")) {
          this.getEditor().replaceSelection("Clipboard data is not an image\n");
        }
        else if (this.settings.cloudName && this.settings.uploadPreset) {
          for (let file of files) {

            const randomString = (Math.random() * 10086).toString(36).substr(0, 8)
            const pastePlaceText = `![uploading...](${randomString})\n`
            this.getEditor().replaceSelection(pastePlaceText)

            const formData = new FormData();
            formData.append('file',file);
            formData.append('upload_preset',this.settings.uploadPreset);
            formData.append('folder',this.settings.folder);

            axios({
              url: `https://api.cloudinary.com/v1_1/${this.settings.cloudName}/upload`,
              method: 'POST',
              data: formData
            }).then(res => {
              const url = objectPath.get(res.data, 'secure_url')
              const imgMarkdownText = `![](${url})`
              this.replaceText(this.getEditor(), pastePlaceText, imgMarkdownText)
            }, err => {
              new Notice(err, 5000)
              console.log(err)
              const dataTransfer = new DataTransfer();
              dataTransfer.items.add(file);
              const newEvt = new ClipboardEvent("paste", {
                clipboardData: dataTransfer
              })
            })
          }
        }
        else {
          new Notice("Cloudinary Image Uploader: Please check the image hosting settings.");
        }
      }
    }
     )
  }

  private replaceText(editor: Editor, target: string, replacement: string): void {
    target = target.trim()
    const lines = editor.getValue().split("\n");
    for (let i = 0; i < lines.length; i++) {
      const ch = lines[i].indexOf(target)
      if (ch !== -1) {
        const from = { line: i, ch };
        const to = { line: i, ch: ch + target.length };
        editor.replaceRange(replacement, from, to);
        break;
      }
    }
  }

  async onload(): Promise<void> {
    console.log("loading Cloudinary Uploader");
    await this.loadSettings();
    this.setupPasteHandler();
    this.addSettingTab(new CloudinaryUploaderSettingTab(this.app, this));
  }

  onunload(): void {
    console.log("unloading Cloudinary Uploader");

  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }
}
