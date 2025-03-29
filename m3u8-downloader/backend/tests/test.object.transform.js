transformObject = (
  object,
  onReplaceKey = undefined,
  onReplaceValue = undefined
) => {
  // if checkpoint is an Object
  if (object instanceof Object && !Array.isArray(object)) {
    const newObj = {};

    Object.keys(checkpoint).forEach((key) => {
      let newKey = onReplaceKey ? onReplaceKey(key) : key;
      // remove underscore if key start with '_'
      // if (newKey.startsWith("_")) {
      //   newKey = newKey.substring(1);
      // }
      newObj[newKey] = transformObject(
        object[key],
        onReplaceKey,
        onReplaceValue
      );
    });

    return newObj;
  } else if (object instanceof Object && Array.isArray(object)) {
    // if checkpoint is an Array
    const newArr = [];

    object.forEach((value, index) => {
      newArr[index] = transformObject(value, onReplaceKey, onReplaceValue);
    });

    return newArr;
  } else {
    // if checkpoint is neither an Object or an Array
    return checkpoint;
  }
};
