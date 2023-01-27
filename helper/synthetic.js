const fs = require("fs")

/**
 * Helper script to convert Jupyter notebook output to LaTeX tables.
 * Run with Node.js.
 */

const tableStructure = {
  abrupt: {
    caption: "Abrupt"
  },
  gradual500: {
    caption: "500 rows wide gradual"
  },
  gradual1000: {
    caption: "1000 rows wide gradual"
  },
  gradual5000: {
    caption: "5000 rows wide gradual"
  },
  gradual10000: {
    caption: "10000 rows wide gradual"
  },
  gradual20000: {
    caption: "20000 rows wide gradual"
  },
}

// Notebook result parsing
function parseFile(filename) {
  const file = fs.readFileSync(filename, "utf-8")

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
      // console.log(filenameEnding);
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
    // console.log(driftType);
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
        encoder = "oe"
        break;
      case "onehot":
        encoder = "ohe"
        break;
      case "target":
      case "None":
        encoder = "te"
        break;
      // case "None":
      //   encoder = ""
      //   break;
      default:
        break;
    }

    let scaler = ")"
    if (i % 2 == 0) {
      scaler = ", u)"
    }

    

    // Construct the row keys
    for (const detectorResult of detectorResults) {

      let detector = detectorResult.split(":")[0].trim()
      if (detector === "PCA_ref") {
        detector = "PCA (fixed, "
      } else if (detector === "PCA_orig") {
        detector = "PCA (cont., "
      } else if (detector === "Stat_ref") {
        detector = "Wilc. (fixed, "
      } else if (detector === "Stat_orig") {
        detector = "Wilc. (cont., "
      } else if (detector === "SCD_unidir") {
        detector = "SCD (unidir., "
      } else if (detector === "SCD_bidir") {
        detector = "SCD (bidir., "
      }
      
      if (filter(detector, encoder, scaler, driftType)) {

        let line = ""
        
        line += detector
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
}

// Filter to leave out excess rows as specified
function filter(detector, encoder, scaler, driftType) {
  if (detector.includes("SCD") && encoder === "ohe") {
    return false
  }
  if (driftType !== "abrupt") {
    if (scaler.includes("u") && (!detector.includes("PCA") || encoder !== "ohe")) {
      return false
    }
    if (detector.includes("Wilc.") && encoder === "ohe") {
      return false
    }
    if (!detector.includes("Wilc.") && encoder === "oe") {
      return false
    }
  }
  return true
}

// Custom sorting of rows
function sortFn(a, b) {
  if (a.startsWith("SCD") && b.startsWith("Wilc")) {
    return 1
  }
  if (a.startsWith("Wilc") && b.startsWith("SCD")) {
    return -1
  }
  return a.localeCompare(b)
}


// Construct the LaTeX tables

parseFile("./data/sea.txt")
parseFile("./data/agraw1.txt")
parseFile("./data/agraw2.txt")
parseFile("./data/agraw_scd.txt")

let output = ""

Object.keys(tableStructure)
  .forEach(driftType => {
    output += "\n\n"
    output +=
`\\begin{table}
    \\centering
    \\begin{tabular}{|l|c|c|c|}
        \\hline
        Method & SEA & Agraw1 & Agraw2 \\\\
        \\hline
        \\hline`
    let previousKey = ""
    for (const key of Object.keys(tableStructure[driftType]).sort(sortFn)) {
      if (key !== "caption") {
        if (previousKey.substring(0, 8) !== key.substring(0, 8)) {
          output += "\n        \\hline"
        }
        output += `\n        ${key} & ${tableStructure[driftType][key].sea || " "} & ${tableStructure[driftType][key].agraw1 || " "} & ${tableStructure[driftType][key].agraw2 || " "} \\\\`
        output += "\n        \\hline"
        previousKey = key
      }
    }
    output += "\n"
    output += 
`    \\end{tabular}
    \\caption{${tableStructure[driftType].caption} drift detection performance in synthetic datasets, measured in False Positive Rate and Latency ($FPR_s$, $L$).}
    \\label{tab:results_synthetic_${driftType}}
\\end{table}`
  })

console.log(output);
fs.writeFileSync("output/tables_synthetic.tex", output)