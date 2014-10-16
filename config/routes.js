/**
 * Route Mappings
 * (sails.config.routes)
 *
 * Your routes map URLs to views and controllers.
 *
 * If Sails receives a URL that doesn't match any of the routes below,
 * it will check for matching files (images, scripts, stylesheets, etc.)
 * in your assets directory.  e.g. `http://localhost:1337/images/foo.jpg`
 * might match an image file: `/assets/images/foo.jpg`
 *
 * Finally, if those don't match either, the default 404 handler is triggered.
 * See `config/404.js` to adjust your app's 404 logic.
 *
 * Note: Sails doesn't ACTUALLY serve stuff from `assets`-- the default Gruntfile in Sails copies
 * flat files from `assets` to `.tmp/public`.  This allows you to do things like compile LESS or
 * CoffeeScript for the front-end.
 *
 * For more information on routes, check out:
 * http://links.sailsjs.org/docs/config/routes
 */

module.exports.routes = {


  // Make the view located at `views/homepage.ejs` (or `views/homepage.jade`, etc. depending on your
  // default view engine) your home page.
  //
  // (Alternatively, remove this and add an `index.html` file in your `assets` directory)
  '/': {
    view: 'homepage'
  },


  // Custom routes here...

  'post /users/forgot-password': {
    controller: 'users',
    action: 'forgotPassword'
  },

  'post /users/reset-password': {
    controller: 'users',
    action: 'resetPassword'
  },

  'post /users': {
    controller: 'users',
    action: 'create'
  },

  'post /users/:id': {
    controller: 'users',
    action: 'update'
  },

  'get /users/:id': {
    controller: 'users',
    action: 'getUser'
  },

  'get /users/:id/reports': {
    controller: 'users',
    action: 'userReports'
  },

  'post /reports': {
    controller: 'reports',
    action: 'create'
  },

  'get /dashboard/now': {
    controller: 'dashboard',
    action: 'now'
  },

  'get /notifications': {
    controller: 'notifications',
    action: 'index'
  },

  'post /notifications': {
    controller: 'notifications',
    action: 'create'
  },

  'post /notifications/:notification_id/delete': {
    controller: 'notifications',
    action: 'destroy'
  },
  'delete /notifications/:notification_id': {
    controller: 'notifications',
    action: 'destroy'
  },

  'get /cron/pushnoti': {
    controller: 'cron',
    action: 'pushnoti'
  },

  'get /cron/email_notification': {
    controller: 'cron',
    action: 'email_notification'
  },

  'post /email/hooks': {
    controller: 'emailsubscriptions',
    action: 'hooks'
  },

  'get /email/send': {
    controller: 'emailsubscriptions',
    action: 'send'
  },

  'post /onetimetoken/validate': {
    controller: 'onetimetoken',
    action: 'validate'
  }

  // If a request to a URL doesn't match any of the custom routes above,
  // it is matched against Sails route blueprints.  See `config/blueprints.js`
  // for configuration options and examples.

};
