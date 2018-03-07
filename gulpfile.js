var gulp = require('gulp');
var minify = require('gulp-minify');

gulp.task('compress', function() {
    gulp.src('src/*.js')
        .pipe(minify({
            noSource: true
        }))
        .pipe(gulp.dest('dist'));
});
