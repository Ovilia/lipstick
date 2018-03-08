var gulp = require('gulp');
var minify = require('gulp-minify');
var jsonminify = require('gulp-jsonminify');

gulp.task('js', function() {
    gulp.src('src/*.js')
        .pipe(minify({
            noSource: true
        }))
        .pipe(gulp.dest('dist'));
});

gulp.task('json', function () {
    return gulp.src(['src/lipstick.json'])
        .pipe(jsonminify())
        .pipe(gulp.dest('dist'));
});

gulp.task('default', ['js', 'json']);
