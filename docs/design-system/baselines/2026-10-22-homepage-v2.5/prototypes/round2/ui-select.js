(function () {
  'use strict';

  function close(control, restoreFocus) {
    if (!control.classList.contains('is-open')) return;
    control.classList.remove('is-open');
    var trigger = control.querySelector('.custom-select-trigger');
    trigger.setAttribute('aria-expanded', 'false');
    if (restoreFocus) trigger.focus();
  }

  function open(control) {
    document.querySelectorAll('.custom-select.is-open').forEach(function (other) {
      if (other !== control) close(other, false);
    });
    control.classList.add('is-open');
    control.querySelector('.custom-select-trigger').setAttribute('aria-expanded', 'true');
  }

  function sync(control) {
    var select = control.querySelector('select');
    var trigger = control.querySelector('.custom-select-trigger');
    var options = Array.prototype.slice.call(control.querySelectorAll('.custom-select-option'));
    var selected = select.selectedIndex;
    trigger.querySelector('.custom-select-label').textContent = select.options[selected].text;
    trigger.setAttribute('aria-label', (select.getAttribute('aria-label') || '选择') + '：' + select.options[selected].text);
    options.forEach(function (option, index) {
      option.setAttribute('aria-selected', String(index === selected));
    });
  }

  function enhance(select) {
    var wrapper = select.parentElement;
    if (!wrapper || wrapper.dataset.enhanced === 'true') return;
    wrapper.dataset.enhanced = 'true';
    wrapper.classList.add('custom-select');
    select.tabIndex = -1;
    select.setAttribute('aria-hidden', 'true');

    var trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'custom-select-trigger';
    trigger.setAttribute('aria-haspopup', 'listbox');
    trigger.setAttribute('aria-label', select.getAttribute('aria-label') || '选择');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.innerHTML = '<span class="custom-select-label"></span><svg class="custom-select-arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 9l7 7 7-7" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';

    var menu = document.createElement('div');
    menu.className = 'custom-select-menu';
    menu.setAttribute('role', 'listbox');
    menu.tabIndex = -1;
    Array.prototype.forEach.call(select.options, function (sourceOption, index) {
      var option = document.createElement('button');
      option.type = 'button';
      option.className = 'custom-select-option';
      option.tabIndex = -1;
      option.setAttribute('role', 'option');
      option.dataset.index = String(index);
      option.textContent = sourceOption.text;
      option.addEventListener('click', function () {
        select.selectedIndex = index;
        select.dispatchEvent(new Event('change', { bubbles: true }));
        sync(wrapper);
        close(wrapper, true);
      });
      menu.appendChild(option);
    });

    wrapper.appendChild(trigger);
    wrapper.appendChild(menu);
    sync(wrapper);

    trigger.addEventListener('click', function () {
      if (wrapper.classList.contains('is-open')) close(wrapper, false);
      else open(wrapper);
    });
    trigger.addEventListener('keydown', function (event) {
      var options = Array.prototype.slice.call(wrapper.querySelectorAll('.custom-select-option'));
      var index = select.selectedIndex;
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        if (!wrapper.classList.contains('is-open')) open(wrapper);
        index = event.key === 'ArrowDown' ? Math.min(index + 1, options.length - 1) : Math.max(index - 1, 0);
        select.selectedIndex = index;
        select.dispatchEvent(new Event('change', { bubbles: true }));
        sync(wrapper);
      } else if (event.key === 'Home' || event.key === 'End') {
        event.preventDefault();
        index = event.key === 'Home' ? 0 : options.length - 1;
        select.selectedIndex = index;
        select.dispatchEvent(new Event('change', { bubbles: true }));
        sync(wrapper);
        open(wrapper);
      } else if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        if (wrapper.classList.contains('is-open')) close(wrapper, false);
        else open(wrapper);
      } else if (event.key === 'Escape') {
        event.preventDefault();
        close(wrapper, true);
      }
    });
    select.addEventListener('change', function () { sync(wrapper); });
    wrapper.addEventListener('focusout', function (event) {
      if (!event.relatedTarget || !wrapper.contains(event.relatedTarget)) close(wrapper, false);
    });
  }

  document.addEventListener('click', function (event) {
    document.querySelectorAll('.custom-select.is-open').forEach(function (control) {
      if (!control.contains(event.target)) close(control, false);
    });
  });

  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('.select-wrap > select').forEach(enhance);
  });
}());
