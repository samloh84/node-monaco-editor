const http = require('http');
const nodePath = require('path');
const child_process = require('child_process');
const os = require('os');

const fs = require('./fs');

const _ = require('lodash');
const express = require('express');

const app = express();
const server = http.createServer(app);

const body_parser = require('body-parser');
const multer = require('multer');
const node_path = require('path');


app.use(body_parser.json({limit: '100MB'}));
app.use(body_parser.urlencoded({extended: true, limit: '100MB'}));


app.use(express.static(nodePath.resolve(process.cwd(), 'static')));


app.get('/files/ls', function (req, res, next) {
    let path = _.get(req.query, 'path', process.cwd());
    return fs.ls(path)
        .then(function (files) {
            console.log(files);
            files = _.map(files, function (file) {
                return {
                    path: file.path,
                    atime: file.stats.atime,
                    mtime: file.stats.mtime,
                    ctime: file.stats.ctime,
                    birthtime: file.stats.birthtime,
                    size: file.stats.size,
                    is_directory: file.stats.isDirectory(),
                    is_file: file.stats.isFile(),
                    basename: node_path.basename(file.path),

                };
            });
            let parent_directory = node_path.dirname(path);

            return res.jsonp({
                path: path,
                files: files,
                parent_directory: parent_directory
            });
        })
        .catch(function (err) {
            return next(err);
        })
});

app.get('/files/read', function (req, res, next) {
    let path = _.get(req.query, 'path');
    try {
        return res.sendFile(fs.resolve(path), {dotfiles: 'allow'})
    } catch (err) {
        return next(err);
    }
});

app.post('/files/write', function (req, res, next) {
    let path = _.get(req.body, 'path');
    let contents = _.get(req.body, 'contents');


    return fs.write_file(path, contents)
        .then(function () {
            return fs.stat(path)
                .then(function (stats) {
                    return res.jsonp({path: path, stats: stats});
                });
        })
        .catch(function (err) {
            return next(err);
        })
});


let upload = multer({dest: 'uploads'});
app.post('/files/upload', upload.any(), function (req, res, next) {
    let path = _.get(req.body, 'path');

    return Promise.map(req.files, function (file) {
        let destination_path = fs.resolve(path, node_path.basename(file.originalname));
        return fs.mv(file.path, destination_path)
            .then(function () {
                return Promise.props({
                    path: destination_path,
                    stats: fs.stat(destination_path)
                });
            })

    })
        .then(function (files) {
            return res.jsonp(files)
        })
        .catch(function (err) {
            return next(err);
        });
});


app.use(function (req, res, next) {
    let error = new Error('Not Found');
    error.status = 404;
    return next(error);
});

app.use(function (err, req, res, next) {

    console.error(err.stack);

    res.status(err.status || 500);
    return res.jsonp({
        status: err.status || 500,
        message: err.message
    });

});

app.listen(3000, function () {
    console.log('Listening on port 3000');
});
