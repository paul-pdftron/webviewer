let viewerWindow;
const viewerElement = document.getElementById('viewer');

const addFormAnnot = () => {
  let name = document.getElementById('name').value.replace(' ', '_');
  const value = document.getElementById('value').value;
  const type = document.getElementById('fieldType').value;
  const flag = {
    readOnly: document.getElementById('readOnly').checked,
    multiline: document.getElementById('multiline').checked,
  };
  name += Date.now();
  document.getElementById('name').value = '';
  document.getElementById('value').value = '';
  document.getElementById('readOnly').checked = false;
  if (type === 'sign' && name !== '') {
    viewerWindow.addFormFieldAnnot('SIGNATURE', name, '', flag);
  } else if (type === 'text' && name !== '') {
    viewerWindow.addFormFieldAnnot('TEXT', name, value, flag);
  } else if (type === 'check' && name !== '') {
    viewerWindow.addFormFieldAnnot('CHECK', name, '', flag);
  }
};

const onFieldTypeValueChanged = () => {
  const dropdownVal = document.getElementById('fieldType').value;
  const multilineCheckboxEl = document.getElementById('multiline');
  // disable multiline option as it doesn't apply to non-text fields
  if (dropdownVal !== 'text') {
    multilineCheckboxEl.disabled = true;
    multilineCheckboxEl.checked = false;
  } else {
    multilineCheckboxEl.disabled = false;
  }
};

// Event listeners
viewerElement.addEventListener('ready', () => {
  viewerWindow = viewerElement.querySelector('iframe').contentWindow;
  viewerWindow.document.body.addEventListener('dragover', e => {
    e.preventDefault();
    return false;
  });
  viewerWindow.document.body.addEventListener('drop', e => {
    const scrollElement = viewerWindow.docViewer.getScrollViewElement();
    const scrollLeft = scrollElement.scrollLeft || 0;
    const scrollTop = scrollElement.scrollTop || 0;
    viewerWindow.setDropPoint({ x: e.pageX + scrollLeft, y: e.pageY + scrollTop });
    e.preventDefault();
    return false;
  });
});

const addElement = document.getElementById('Add');
addElement.addEventListener('click', addFormAnnot);
addElement.addEventListener('dragstart', e => {
  e.target.style.opacity = 0.5;
  const copy = e.target.cloneNode(false);
  copy.id = 'form-build-drag-image-copy';
  const isCheckBox = document.getElementById('fieldType').value === 'check';
  copy.style.width = isCheckBox ? '50px' : '250px';
  copy.style.height = '50px';
  copy.style.borderRadius = 0;
  copy.style.backgroundColor = 'rgba(211,211,211, 0.5)';
  copy.style.border = '1px solid rgba(0,165,228)';
  copy.style.padding = 0;
  copy.style.position = 'absolute';
  copy.style.top = '-500px';
  copy.style.left = '-500px';
  document.body.appendChild(copy);
  e.dataTransfer.setDragImage(copy, isCheckBox ? 25 : 125, 25);
  e.dataTransfer.setData('text', '');
});

addElement.addEventListener('dragend', e => {
  addFormAnnot();
  e.target.style.opacity = 1;
  document.body.removeChild(document.getElementById('form-build-drag-image-copy'));
  e.preventDefault();
});

document.getElementById('Apply').addEventListener('click', () => {
  viewerWindow.convertAnnotToFormField();
});

document.getElementById('fieldType').addEventListener('change', () => {
  onFieldTypeValueChanged();
});
// in case first dropdown value on init is not of type text
// disable multiline checkbox
onFieldTypeValueChanged();
