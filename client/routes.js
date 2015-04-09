Router.route('/', function() {
  this.redirect('/nonFollowers');
});

Router.route('/nonFollowers');
Router.route('/fans');
Router.route('/copyFollowers');
Router.route('/copyInfluencers');
Router.route('/allFollowings');
Router.route('/blacklist');
Router.route('/whitelist');
