/* @ds-bundle: {"format":4,"namespace":"Handoff","components":[{"name":"Button"},{"name":"StatusPill"},{"name":"AssetRow"},{"name":"Amount"}]} */
(function () {
  var React = window.React;
  var h = React.createElement;

  function cx() {
    var out = [];
    for (var i = 0; i < arguments.length; i++) if (arguments[i]) out.push(arguments[i]);
    return out.join(' ');
  }

  function Button(props) {
    var variant = props.variant || 'primary';
    var size = props.size || 'md';
    return h('button', {
      type: props.type || 'button',
      className: cx('hf-btn', 'hf-btn--' + variant, size !== 'md' && 'hf-btn--' + size, props.className),
      disabled: props.disabled,
      onClick: props.onClick,
      'aria-label': props.ariaLabel
    }, props.children);
  }

  var ICONS = {
    verified: h('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true' }, h('path', { d: 'M20 6 9 17l-5-5' })),
    blocked: h('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true' }, h('path', { d: 'M18 6 6 18M6 6l12 12' })),
    pending: h('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true' }, h('circle', { cx: 12, cy: 12, r: 9 }), h('path', { d: 'M12 7v5l3 2' })),
    sponsored: h('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true' }, h('path', { d: 'M13 2 3 14h8l-1 8 10-12h-8l1-8z' })),
    agent: h('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true' }, h('rect', { x: 4, y: 6, width: 16, height: 14, rx: 3 }), h('path', { d: 'M9 12h.01M15 12h.01M12 3v3' }))
  };
  var LABELS = { verified: 'Verificado', blocked: 'Bloqueado', pending: 'Pendiente', sponsored: 'Gas patrocinado', agent: 'Agente' };

  function StatusPill(props) {
    var status = props.status || 'verified';
    return h('span', { className: cx('hf-pill', 'hf-pill--' + status, props.className) },
      ICONS[status], props.children || LABELS[status]);
  }

  function Amount(props) {
    var value = props.value;
    var cur = props.currency;
    return h('span', { className: cx('hf-amount', props.size === 'l' && 'hf-amount--l', props.muted && 'hf-amount--muted', props.className) },
      cur ? h('span', { className: 'hf-amount__cur' }, cur) : null, value);
  }

  var ROW_ICON = h('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true' },
    h('rect', { x: 5, y: 3, width: 14, height: 18, rx: 1.5 }),
    h('path', { d: 'M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2' }));

  function AssetRow(props) {
    var tone = props.deltaTone || (props.delta && props.delta[0] === '-' ? 'down' : props.delta ? 'up' : 'flat');
    var Tag = props.href ? 'a' : 'div';
    return h(Tag, { className: cx('hf-row', props.className), href: props.href, onClick: props.onClick },
      h('span', { className: 'hf-row__icon' }, props.icon || ROW_ICON),
      h('span', { className: 'hf-row__main' },
        h('span', { className: 'hf-row__name' }, props.name),
        props.meta ? h('span', { className: 'hf-row__meta' }, props.meta) : null),
      h('span', { className: 'hf-row__side' },
        h(Amount, { value: props.price, currency: props.currency || 'USDC' }),
        props.delta ? h('span', { className: cx('hf-row__delta', 'hf-row__delta--' + tone) }, props.delta) : null));
  }

  window.Handoff = { Button: Button, StatusPill: StatusPill, AssetRow: AssetRow, Amount: Amount };
})();
