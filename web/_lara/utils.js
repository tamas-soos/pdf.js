export function debounce(func, wait = 100) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      func.apply(this, args);
    }, wait);
  };
}

export function convertToArray(rectList) {
  const arr = [];
  for (let i = 0; i < rectList.length; i++) {
    arr.push(rectList[i]);
  }
  return arr;
}
