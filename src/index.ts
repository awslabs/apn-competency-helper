import * as fs from "fs"
import ExcelJS from "exceljs"
import { test, rm, mkdir, cp } from "shelljs"
import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  Paragraph
} from "docx"
import pptxgen from "pptxgenjs"
import { zip } from "zip-a-folder"
import axios from "axios"
const { AutoComplete, Select } = require("enquirer")

async function main(): Promise<void> {
  const competencies: any = require("./competencies.json")

  //Prompt

  const prompt = new AutoComplete({
    name: "flavor",
    message: "Pick your favorite flavor",
    limit: 10,
    choices: Object.keys(competencies)
  })

  const competency = await prompt.run()
  const choices2 = Object.keys(competencies[competency])

  const prompt2 = new Select({
    name: "partnerType",
    message: "What is the type of Partner?",
    choices: choices2
  })

  const partnerType = await prompt2.run()
  const urls: any = competencies[competency][partnerType]
  const outDir = "var/out/" + competency

  //Cleaning
  if (test("-d", "var")) {
    rm("-rf", "var")
  }

  mkdir("var", "var/in", "var/out", outDir)

  //Download checklist
  const response = await axios({
    method: "GET",
    url: urls.checklistUrl,
    responseType: "stream"
  })

  const filename = "var/in/" + competency + ".xlsx"
  await fs.promises.writeFile(filename, response.data)

  //Presentation
  let pres = new pptxgen()
  pres.layout = "LAYOUT_WIDE"

  //First Slide
  const firstSlide = pres.addSlide()
  firstSlide.background = { color: "FF9900" }
  firstSlide.addImage({
    path: "./assets/AWS_logo_RGB_WHT.png",
    x: 12,
    y: 0.3,
    h: 0.6,
    w: 0.9
  })
  firstSlide.addText("APN Competency Program", {
    x: 0.5,
    y: 2.5,
    h: 0.75,
    w: "80%",
    fontSize: 24,
    color: "FFFFFF"
  })
  firstSlide.addText(competency, {
    x: 0.5,
    y: 3.25,
    h: 0.75,
    w: "80%",
    fontSize: 48,
    color: "FFFFFF"
  })

  pres.defineSlideMaster({
    title: "PLACEHOLDER_SLIDE",
    background: { color: "FFFFFF" },
    objects: [
      { rect: { x: 0, y: 0, w: "100%", h: 0.8, fill: { color: "FF9900" } } },
      {
        rect: {
          x: 0,
          y: 0.8,
          w: 5.1,
          h: 6.7,
          fill: { color: "FF9900", transparency: 20 }
        }
      },
      {
        placeholder: {
          options: {
            name: "head",
            type: "title",
            color: "FFFFFF",
            x: 0.5,
            y: 0.1,
            w: 12,
            h: 0.75,
            fontSize: 28,
            align: "left",
            bold: true
          }
        }
      },
      {
        placeholder: {
          options: {
            name: "description",
            type: "body",
            color: "FFFFFF",
            x: 0.5,
            y: 1.1,
            w: 4,
            h: 5.8,
            fontSize: 10,
            align: "left"
          }
        }
      },
      {
        placeholder: {
          options: {
            name: "details",
            type: "body",
            x: 5.6,
            y: 1.1,
            w: 7,
            h: 6,
            align: "left"
          }
        }
      }
    ],
    slideNumber: { x: 12.3, y: "95%", fontSize: 11, align: "right" }
  })

  //Reading the workbook
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(filename)

  workbook.eachSheet((worksheet, sheetId) => {
    if (sheetId === 1) {
      return
    }
    mkdir(outDir + "/" + worksheet.name)

    worksheet.eachRow((row, rowNumber) => {
      row.eachCell(function (cell, colNumber) {
        if (row.actualCellCount === 2) {
          if (colNumber === 1) {
            const id: any = competency + " - " + cell.value

            const nextCell: any = row.getCell(2) ?? {}
            let head: string = nextCell.value.richText[0].text
            head = head.replace("/", " - ")

            //Split text by \n and create paragraphs
            const descriptionCellValue = nextCell.value.richText[1].text
            const descriptionLiterals: any = descriptionCellValue.split("\n")
            const descriptionParagraphs: any = []

            descriptionLiterals.map((descriptionLiteral: string) => {
              descriptionParagraphs.push(
                new Paragraph({
                  text: descriptionLiteral,
                  alignment: AlignmentType.JUSTIFIED
                })
              )
            })

            mkdir(outDir + "/" + worksheet.name + "/" + id + " " + head)

            //Build Document
            const doc = new Document({
              sections: [
                {
                  properties: {},
                  children: [
                    new Paragraph({
                      text: id,
                      heading: HeadingLevel.TITLE
                    }),
                    new Paragraph({
                      text: head,
                      heading: HeadingLevel.HEADING_1
                    }),
                    ...descriptionParagraphs,
                    new Paragraph({
                      border: {
                        bottom: {
                          color: "auto",
                          space: 1,
                          style: BorderStyle.SINGLE,
                          size: 6
                        }
                      }
                    })
                  ]
                }
              ]
            })

            //Write document
            Packer.toBuffer(doc).then((buffer) => {
              fs.writeFileSync(
                outDir +
                  "/" +
                  worksheet.name +
                  "/" +
                  id +
                  " " +
                  head +
                  "/" +
                  id +
                  ".docx",
                buffer
              )
            })

            //Add slide for the general presentation
            let slide = pres.addSlide({ masterName: "PLACEHOLDER_SLIDE" })
            slide.addText(id + " " + head, { placeholder: "head" })
            slide.addText(descriptionCellValue, { placeholder: "description" })
          }
        }
      })
    })
  })

  //Copy a version of the self service checklist
  cp(filename, outDir + "/" + competency + ".xlsx")

  //Last slide
  const lastSlide = pres.addSlide()
  lastSlide.background = { color: "FF9900" }
  lastSlide.addImage({
    path: "./assets/AWS_logo_RGB_WHT.png",
    x: 12,
    y: 0.3,
    h: 0.6,
    w: 0.9
  })
  lastSlide.addText("APN Competency Program", {
    x: 0.5,
    y: 2.5,
    h: 0.75,
    w: "80%",
    fontSize: 24,
    color: "FFFFFF"
  })
  lastSlide.addText("Thank you!", {
    x: 0.5,
    y: 3.25,
    h: 0.75,
    w: "80%",
    fontSize: 48,
    color: "FFFFFF"
  })

  //Write the presentation
  await pres.writeFile({ fileName: outDir + "/presentation.pptx" })

  //Zip the whole thing
  await zip(outDir, "./var/" + competency + ".zip")

  //Clean
  rm("-rf", "var/in")
  rm("-rf", "var/out")
}

main().catch(console.error)
