document.addEventListener('DOMContentLoaded', function () {
  // Flash message auto-dismiss
  document.querySelectorAll('.flash').forEach(function (flash) {
    setTimeout(function () {
      flash.style.cssText = 'opacity: 0; transition: opacity 0.5s ease-out;';
      setTimeout(function () { flash.remove(); }, 500);
    }, 4000);
  });

  // Flash dismiss buttons
  document.querySelectorAll('.flash .dismiss, .flash .flash-dismiss').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var flash = this.parentElement;
      flash.style.cssText = 'opacity: 0; transition: opacity 0.5s ease-out;';
      setTimeout(function () { flash.remove(); }, 500);
    });
  });

  // Password toggle
  window.togglePassword = function (btn) {
    var input = btn.parentElement.querySelector('input[type="password"], input[type="text"]');
    if (!input) return;
    var isPassword = input.type === 'password';
    input.type = isPassword ? 'text' : 'password';
    btn.textContent = isPassword ? 'Hide' : 'Show';
  };

  // Rating buttons
  document.querySelectorAll('.rating-group').forEach(function (group) {
    group.addEventListener('click', function (e) {
      var button = e.target.closest('button.rating-btn');
      if (!button) return;
      group.querySelectorAll('button.rating-btn').forEach(function (btn) {
        btn.classList.remove('selected');
      });
      button.classList.add('selected');
      var input = group.querySelector('input[name="rating"][type="hidden"]');
      if (input) input.value = button.dataset.value;
    });
  });

  // Form loading states
  document.querySelectorAll('form[data-loading]').forEach(function (form) {
    form.addEventListener('submit', function () {
      var button = this.querySelector("button[type='submit']");
      if (button && !button.disabled) {
        button.classList.add('is-loading');
        button.disabled = true;
      }
    });
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', function (e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
    if (window.location.pathname === '/flashcards/session') return;

    if (e.key === 't' || e.key === 'T') {
      e.preventDefault();
      Alpine.store('theme').toggle();
      return;
    }

    var navLink = document.querySelector('.nav-link[data-key="' + e.key + '"]');
    if (navLink) { e.preventDefault(); navLink.click(); }
  });

  // Smooth scroll for anchor links
  document.querySelectorAll('a[href^="#"]').forEach(function (link) {
    link.addEventListener('click', function (e) {
      var targetId = this.getAttribute('href').substring(1);
      var targetElement = document.getElementById(targetId);
      if (targetElement) {
        e.preventDefault();
        targetElement.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });
});
