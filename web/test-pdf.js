const { PDFParse } = require("pdf-parse");
async function test() {
  const pdf = new PDFParse(Buffer.from("JVBERi0xLg==")); // dummy buffer
  console.log(pdf);
}
test();
