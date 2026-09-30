// Fixture script: readable on purpose, not minified. It only counts clicks on the order link.
(function () {
  'use strict';

  var clicks = 0;

  function onOrderClick() {
    clicks = clicks + 1;
    document.documentElement.setAttribute('data-order-clicks', String(clicks));
  }

  function start() {
    var link = document.querySelector('a[href="#pedido"]');
    if (!link) {
      return;
    }
    link.addEventListener('click', onOrderClick);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
