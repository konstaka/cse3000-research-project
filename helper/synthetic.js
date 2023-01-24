const fs = require("fs")

const tableStructure = {
  abrupt: {},
  gradual500: {},
  gradual1000: {},
  gradual5000: {},
  gradual10000: {},
  gradual20000: {}
}

function parseSEA() {
  const file = fs.readFileSync("./data/sea.txt", "utf-8")

  const lines = file.split("\n")
  
  const resultLines = []
  
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().startsWith("synthetic_data/")) {
      resultLines.push({
        filename: lines[i],
        results: `${lines[i+1]} ${lines[i+2]}`
      })
    }
  }
  
  for (let i = 0; i < resultLines.length; i++) {
    const detectorResults = resultLines[i].results.split(")")
      .filter(result => result.trim())
      .map(result => `${result})`)

    // Determine the table and column for this line
    let driftType = "abrupt"
    if (resultLines[i].filename.includes("gradual")) {
      driftType = "gradual"
      const filenameEnding = resultLines[i].filename.split("noise_balanced")[1]
      console.log(filenameEnding);
      if (filenameEnding.startsWith("_05.")) {
        driftType += "500"
      } else if (filenameEnding.startsWith("_1.")) {
        driftType += "1000"
      } else if (filenameEnding.startsWith("_5.")) {
        driftType += "5000"
      } else if (filenameEnding.startsWith("_10.")) {
        driftType += "10000"
      } else if (filenameEnding.startsWith("_20.")) {
        driftType += "20000"
      }
    }
    console.log(driftType);
    let dataset = "sea"
    if (resultLines[i].filename.includes("agraw1")) {
      dataset = "agraw1"
    } else if (resultLines[i].filename.includes("agraw2")) {
      dataset = "agraw2"
    }

    // Determine the encoder and scaler markings
    let encoder = resultLines[i].filename.split("encoder: ")[1]
    switch (encoder) {
      case "ordinal":
      case "None":
        encoder = "oe"
        break;
      case "onehot":
        encoder = "ohe"
        break;
      case "target":
        encoder = "te"
        break;
      default:
        break;
    }

    let scaler = ")"
    if (i % 2 != 0) {
      scaler = ", s)"
    }

    // Construct the LaTeX lines
    for (const detectorResult of detectorResults) {
      let line = ""
      const detector = detectorResult.split(":")[0].trim()
      if (detector === "PCA_ref") {
        line += "PCA (fixed, "
      } else if (detector === "PCA_orig") {
        line += "PCA (cont., "
      } else if (detector === "Stat_ref") {
        line += "Wilc. (fixed, "
      } else if (detector === "Stat_orig") {
        line += "Wilc. (cont., "
      } else if (detector === "SCD_unidir") {
        line += "SCD (unidir., "
      }
      line += encoder
      line += scaler

      // Add to the structure
      if (!tableStructure[driftType][line]) {
        tableStructure[driftType][line] = {
          sea: "",
          agraw1: "",
          agraw2: ""
        }
      }
      tableStructure[driftType][line][dataset] = detectorResult.split("] ")[1]
    }
  }
}

parseSEA()

console.log(tableStructure);