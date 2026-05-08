import fs from "node:fs";
import path from "node:path";

function ensureDirectory(filePath) {
  const directory = path.dirname(filePath);
  fs.mkdirSync(directory, { recursive: true });
}

export class FileStateStore {
  constructor(filePath) {
    this.filePath = filePath;
  }

  load() {
    if (!fs.existsSync(this.filePath)) {
      return null;
    }

    const raw = fs.readFileSync(this.filePath, "utf8");
    return JSON.parse(raw);
  }

  save(state) {
    ensureDirectory(this.filePath);
    fs.writeFileSync(this.filePath, JSON.stringify(state, null, 2), "utf8");
  }
}
