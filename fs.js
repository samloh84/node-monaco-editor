const fs = require('fs');
const node_path = require('path');
const Promise = require('bluebird');
const _ = require('lodash');

let resolve = function () {
    let args = _.concat([process.cwd()], arguments);
    return node_path.resolve.apply(node_path, args);
};


let read_dir = function (path, with_file_types) {
    path = resolve(path);
    return Promise.resolve(fs.promises.readdir(path, {withFileTypes: with_file_types}));
};

let read_file = function (path) {
    path = resolve(path);
    return Promise.resolve(fs.promises.readFile(path));
};

let write_file = function (path, data) {
    path = resolve(path);
    return Promise.resolve(fs.promises.writeFile(path, data));
};

let mkdir = function (path) {
    path = resolve(path);
    return Promise.resolve(fs.promises.mkdir(path, {recursive: true}));
};

let unlink = function (path) {
    path = resolve(path);
    return Promise.resolve(fs.promises.unlink(path));
};

let rmdir = function (path) {
    path = resolve(path);
    return Promise.resolve(fs.promises.rmdir(path));
};

let stat = function (path) {
    path = resolve(path);
    return Promise.resolve(fs.promises.stat(path));
};


let ls = function (path, recursive) {
    path = resolve(path);

    let file_list = [];
    let errors = [];

    let walk = function (path) {
        return stat(path)
            .then(function (stats) {
                if (stats.isDirectory()) {
                    return read_dir(path)
                        .then(function (files) {
                            return Promise.map(files, function (file) {
                                let file_path = resolve(path, file);
                                return Promise.props({
                                    path: file_path,
                                    stats: stat(file_path)
                                })
                                    .tap(function (props) {
                                        file_list.push(props);
                                    });
                            })
                        })
                        .then(function (files) {
                            if (recursive) {
                                let subdirectories = _.map(_.filter(files, function (file) {
                                    return file.stats.isDirectory()
                                }), 'path');
                                return Promise.map(subdirectories, walk);
                            }
                        })
                } else {
                    return Promise.props({
                        path: path,
                        stats: stat(path)
                    })
                        .tap(function (props) {
                            file_list.push(props);
                        });
                }
            });
    };


    return walk(path)
        .then(function () {
            if (!_.isEmpty(errors)) {
                throw new Error('Errors occurred:\n\n' + _.map(errors, 'stack').join('\n\n'));
            }
            return file_list;
        });
};

let rm = function (path, recursive) {

    path = resolve(path);

    let errors = [];

    let walk = function (path) {
        return stat(path)
            .then(function (stats) {
                let recursive_promise;
                if (recursive && stats.isDirectory()) {
                    recursive_promise = read_dir(path)
                        .then(function (files) {
                            return Promise.map(files, function (file) {
                                let file_path = resolve(path, file);
                                return walk(file_path);
                            });
                        })
                } else {
                    recursive_promise = Promise.resolve();
                }

                return recursive_promise
                    .then(function () {
                        if (stats.isDirectory()) {
                            return rmdir(path);
                        } else {
                            return unlink(path);
                        }
                    })
            })
            .catch(function (err) {
                errors.push(err);
            });
    };

    return walk(path)
        .then(function () {
            if (!_.isEmpty(errors)) {
                throw new Error('Errors occurred:\n\n' + _.map(errors, 'stack').join('\n\n'));
            }
        });
};


let cp = function (source_path, destination_path) {
    source_path = resolve(source_path);
    destination_path = resolve(destination_path);


    return new Promise(function (resolve, reject) {
        try {
            let read_stream = fs.createReadStream(source_path);
            let write_stream = fs.createWriteStream(destination_path);

            read_stream.on('error', function (err) {
                return reject(err);
            });

            write_stream.on('error', function (err) {
                return reject(err);
            });

            write_stream.on('close', function () {
                return resolve();
            });

            read_stream.pipe(write_stream);
        } catch (err) {
            return reject(err);
        }
    });
};

let mv = function (source_path, destination_path) {
    return cp(source_path, destination_path)
        .then(function () {
            return unlink(source_path);
        });
}


module.exports = {
    resolve: resolve,
    read_dir: read_dir,
    read_file: read_file,
    write_file: write_file,
    mkdir: mkdir,
    unlink: unlink,
    rmdir: rmdir,
    ls: ls,
    rm: rm,
    cp: cp,
    mv: mv,
    stat: stat
};

