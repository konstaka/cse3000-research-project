const fs = require("fs")

/**
 * Helper script to convert Jupyter notebook output to LaTeX tables.
 * Run with Node.js.
 */

const tableStructure = {}

// Notebook result parsing
function parseFile(filename) {
  const file = fs.readFileSync(filename, "utf-8")

  const lines = file.split("\n")
  
  const resultLines = []
  
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().startsWith("real_world_data/")) {
      resultLines.push({
        filename: lines[i],
        results: lines[i+1]
      })
    }
  }
  
  for (let i = 0; i < resultLines.length; i++) {
    const detectorResults = resultLines[i].results.split(")")
      .filter(result => result.trim())
      .map(result => `${result})`)

    let dataset = "airlines"
    if (resultLines[i].filename.includes("weather")) {
      if (resultLines[i].filename.includes("yearly")) {
        dataset = "weather_yearly"
      } else {
        dataset = "weather_monthly"
      }
    } else if (resultLines[i].filename.includes("spam")) {
      dataset = "spam"
    } else if (resultLines[i].filename.includes("electricity")) {
      dataset = "elect2"
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
        encoder = "te"
        break;
      case "None":
      default:
        encoder = undefined
        break;
    }

    let scaler
    if (i % 2 == 0) {
      scaler = "u"
    }

    // Construct the row keys
    for (const detectorResult of detectorResults) {

      let detector = detectorResult.split(":")[0].trim()
      if (detector === "PCA_ref") {
        detector = "PCA "
      } else if (detector === "Stat_ref") {
        detector = "Wilc. "
      } else if (detector === "SCD_unidir") {
        detector = "SCD "
      }
      
      if (filter(detector, encoder, scaler)) {

        let line = detector
        
        if (encoder || scaler) {
          const markings = []
          if (encoder) {
            markings.push(encoder)
          }
          if (scaler) {
            markings.push(scaler)
          }
          line += `(${markings.join(", ")})`
        }

        // Add to the structure
        if (!tableStructure[line]) {
          tableStructure[line] = {
            airlines: {},
            elect2: {},
            spam: {},
            weather_yearly: {},
            weather_monthly: {}
          }
        }
        tableStructure[line][dataset] = computePerformance(dataset, detectorResult.split("[")[1].split("]")[0].split(","))
      }
    }
  }
}

// Filter to leave out excess rows as specified
function filter(detector, encoder, scaler) {
  if (detector.includes("SCD") && encoder === "ohe") {
    return false
  }
  // if (driftType !== "abrupt") {
  //   if (scaler.includes("u") && (!detector.includes("PCA") || encoder !== "ohe")) {
  //     return false
  //   }
  //   if (detector.includes("Wilc.") && encoder === "ohe") {
  //     return false
  //   }
  //   if (!detector.includes("Wilc.") && encoder === "oe") {
  //     return false
  //   }
  // }
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
  if (a.startsWith("Wilc") && b.startsWith("PCA")) {
    return 1
  }
  if (a.startsWith("PCA") && b.startsWith("Wilc")) {
    return -1
  }
  if (!a.includes("(u)") && b.includes("(u)")) {
    return 1
  }
  if (a.includes("(u)") && !b.includes("(u)")) {
    return -1
  }
  return a.localeCompare(b)
}

function getRealDriftsFromCsv(dataset) {
  const realDrifts = []
  let csv
  let lines
  switch (dataset) {
    case "elect2":
      csv = fs.readFileSync("data/ElecDatasetPredict.csv", "utf-8")
      lines = csv.split("\n")
      for (let i = 1; i < lines.length - 1; i++) {
        if (lines[i].split(",")[1] > 0) {
          realDrifts.push(i)
        }
        // console.log(lines[i]);
        // console.log(i, parseInt(lines[i].split(",")[0], 10) + 1 === i, lines[i].split(",")[1] > 0);
      }
      break;

    case "weather_monthly":
    case "weather_yearly":
      csv = fs.readFileSync(`data/${dataset}_drifts.csv`, "utf-8")
      lines = csv.split(",")
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes("True")) {
          realDrifts.push(i + 1)
        }
        // console.log(lines[i]);
        // console.log(lines[i].includes("True"));
      }
      break;
  
    default:
      break;
  }
  // console.log(realDrifts);
  return realDrifts
}

// getRealDriftsFromCsv("weather_monthly")
// getRealDriftsFromCsv("weather_yearly")
// process.exit(0)

// Compute performance metrics here so detectors don't need to be run again if the reference changes.
function computePerformance(dataset, detectedDrifts) {
  const reference = {
    airlines: { nBatches: 22, realDrifts: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22] },
    elect2: { nBatches: 83, realDrifts: getRealDriftsFromCsv("elect2") },
    weather_monthly: { nBatches: 403, realDrifts: getRealDriftsFromCsv("weather_monthly") },
    weather_yearly: { nBatches: 33, realDrifts: getRealDriftsFromCsv("weather_yearly") },
  }

  const drifts = detectedDrifts
    .filter(item => item.trim())
    .map(item => parseInt(item, 10))
    .filter(item => item <= reference[dataset].nBatches)

  // console.log(drifts);

  if (drifts.length <= 0) {
    return { fpr: 0.0, acc: 0.0 }
  }

  const falsePositives = drifts.filter(detectedDrift => !reference[dataset].realDrifts.includes(detectedDrift))
  const correctPositives = reference[dataset].realDrifts.filter(realDrift => drifts.includes(realDrift))

  const nNonDriftingBatches = reference[dataset].nBatches - reference[dataset].realDrifts.length

  const fpr = falsePositives.length / nNonDriftingBatches
  const acc = correctPositives.length / reference[dataset].realDrifts.length

  return { fpr, acc }
}

function printLine(key, prevKey, datasets) {
  let emptyLine = false
  for (let i = 0; i < datasets.length; i++) {
      dataset = datasets[i]
    if (tableStructure[key][dataset].fpr === undefined || tableStructure[key][dataset].acc === undefined) {
      emptyLine = true
    }
  }
  let line = ""
  if (!emptyLine) {
    if (prevKey.substring(0, 3) !== key.substring(0, 3)) {
      line += "\n        \\hline"
    }
    line += `\n        ${key}`
    for (let i = 0; i < datasets.length; i++) {
      dataset = datasets[i]
      // console.log(dataset, key, tableStructure[key][dataset], tableStructure[key][dataset].fpr !== undefined, tableStructure[key][dataset].acc !== undefined);
      const fpr = tableStructure[key][dataset].fpr
      const acc = tableStructure[key][dataset].acc
      let result = ""
      if (fpr !== undefined && acc !== undefined) {
        result = `(${new Number(fpr).toPrecision(2)}, ${new Number(acc).toPrecision(2)})`
      }
      line += ` & ${result}`
    }
    line += ` \\\\`
    line += "\n        \\hline"
  }
  return line
}


// Construct the LaTeX tables
parseFile("./data/airlines_syncstream.txt")
parseFile("./data/elect2.txt")
parseFile("./data/weather.txt")

let output = 
`\\begin{table}
    \\centering
    \\begin{tabular}{|l|c|}
        \\hline
        Method & Airlines \\\\
        \\hline
        \\hline`
let previousKey = ""
let datasets = ["airlines"]
for (const key of Object.keys(tableStructure).sort(sortFn)) {
  const line = printLine(key, previousKey, datasets)
  output += line
  if (line) {
    previousKey = key
  }
}
output += "\n"
output += 
`    \\end{tabular}
    \\caption{Drift detection performance on the real world dataset Airlines, measured in False Positive Rate and Accuracy ($FPR_{rw}$, $Acc$). Both SyncStream methods use a fixed reference.}
    \\label{tab:results_real_world_airlines_elect2}
\\end{table}`


output += "\n\n"
output +=
`\\begin{table}
    \\centering
    \\begin{tabular}{|l|c|}
        \\hline
        Method & Elect2 \\\\
        \\hline
        \\hline`
previousKey = ""
datasets = ["elect2"]
for (const key of Object.keys(tableStructure).sort(sortFn)) {
  const line = printLine(key, previousKey, datasets)
  output += line
  if (line) {
    previousKey = key
  }
}
output += "\n"
output += 
`    \\end{tabular}
    \\caption{Drift detection performance on the real world dataset Elect2, measured in False Positive Rate and Accuracy ($FPR_{rw}$, $Acc$). Both SyncStream methods use a fixed reference, and SCD is run in only one direction.}
    \\label{tab:results_real_world_airlines_elect2}
\\end{table}`

output += "\n\n"
output += 
`\\begin{table}
    \\centering
    \\begin{tabular}{|l|c|c|}
        \\hline
        Method & Weather (monthly) & Weather (yearly) \\\\
        \\hline
        \\hline`
previousKey = ""
datasets = ["weather_monthly", "weather_yearly"]
for (const key of Object.keys(tableStructure).sort(sortFn)) {
  const line = printLine(key, previousKey, datasets)
  output += line
  if (line) {
    previousKey = key
  }
}
output += "\n"
output += 
`    \\end{tabular}
    \\caption{Drift detection performance on the real world dataset Weather, measured in False Positive Rate and Accuracy ($FPR_{rw}$, $Acc$). Monthly and yearly batching was used for the test data. Both SyncStream methods use a fixed reference, and SCD is run in only one direction.}
    \\label{tab:results_real_world_weather}
\\end{table}`

output += "\n\n"
output += 
`\\begin{table}
    \\centering
    \\begin{tabular}{|l|c|c|c|}
        \\hline
        Method & Spam (100) & Spam (50) & Spam (20) \\\\
        \\hline
        \\hline`
previousKey = ""
for (const key of Object.keys(tableStructure).sort(sortFn)) {
  if (previousKey.substring(0, 3) !== key.substring(0, 3)) {
    output += "\n        \\hline"
  }
  output += `\n        ${key}`
  output += ` & (${new Number(tableStructure[key].spam.fpr).toPrecision(2)}, ${new Number(tableStructure[key].spam.acc).toPrecision(2)})` // 100
  output += ` & (${new Number(tableStructure[key].spam.fpr).toPrecision(2)}, ${new Number(tableStructure[key].spam.acc).toPrecision(2)})` // 50
  output += ` & (${new Number(tableStructure[key].spam.fpr).toPrecision(2)}, ${new Number(tableStructure[key].spam.acc).toPrecision(2)}) \\\\` // 20
  output += "\n        \\hline"
  previousKey = key
}
output += "\n"
output += 
`    \\end{tabular}
    \\caption{Drift detection performance on the real world dataset Spam, measured in False Positive Rate and Accuracy ($FPR_{rw}$, $Acc$). Batch sizes of 100, 50, and 20 were used for the test data. Both SyncStream methods use a fixed reference, and SCD is run in only one direction.}
    \\label{tab:results_real_world_spam}
\\end{table}`

console.log(output);
fs.writeFileSync("output/tables_real_world.tex", output)