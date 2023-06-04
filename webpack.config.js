const path = require("path");

module.exports = {
  mode: "development",
  devtool: "inline-source-map",
  entry: "./out/webview/webview/webview.js",
  output: {
    filename: "[name].bundle.js",
    path: path.resolve(__dirname, "dist"),
  },
  target: "web",
  cache: true,
  // optimization: {
  //   splitChunks: {
  //     chunks: "all",
  //   },
  // },
  module: {
    rules: [
      {
        test: /\.js$/,
      },
    ],
  },
};
