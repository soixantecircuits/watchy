var expect = require('expect.js'),
    filewatcher = require('..');

describe('filewatcher', function() {
  it('should say Initialized', function(done) {
    expect(filewatcher()).to.equal('...Initialized');
    done();
  });
});
