const path = require('path');

module.exports = (_env, argv = {}) => {
  const mode = argv.mode || 'production';
  const isDevelopment = mode === 'development';

  return {
    entry: './src/main.ts',
    mode,
    devtool: isDevelopment ? 'eval-cheap-module-source-map' : false,
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          use: {
            loader: 'ts-loader',
            options: {
              compilerOptions: {
                noEmit: false,
              },
            },
          },
          exclude: /node_modules/,
        },
      ],
    },
    resolve: {
      extensions: ['.tsx', '.ts', '.js'],
    },
    output: {
      filename: 'bundle.js',
      path: path.resolve(__dirname, 'dist'),
    },
    devServer: {
      static: {
        directory: path.join(__dirname, '.'),
      },
      compress: true,
      port: 8080,
    },
  };
};
