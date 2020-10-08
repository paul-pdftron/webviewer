(function(exports) {
  let enabled;
  let value;
  const enable = enbled => {
    enabled = enbled;
  };

  const isEnabled = () => {
    return enabled;
  };
  // value must be a decimal between 0 - 1 (inclusive)
  const setValue = val => {
    if (val >= 0 && val <= 1) {
      value = val;
    } else {
      throw new Error('value must be a decimal between 0 - 1 (inclusive)');
    }
  };

  const getValue = () => {
    return value;
  };

  const getDisabledCSSStyle = () => {
    if (!enabled) {
      return 'opacity: 0.5; cursor: not-allowed;';
    }
    return '';
  };

  exports.DiffOverlaySlider = {
    getDisabledCSSStyle,
    enable,
    isEnabled,
    setValue,
    getValue,
  };
})(window);
