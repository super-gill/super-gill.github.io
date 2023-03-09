let result = document.getElementById('result');
      
      function add(value) {
        result.value += value;
      }
      
      function calculate() {
        result.value = eval(result.value);
      }
      
      function clearAll() {
        result.value = '';
      }