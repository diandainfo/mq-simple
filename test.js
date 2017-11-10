let num = 1;

class Test {
    constructor() {
        this.num = 0;
    }
    test1() {
        this.test2();
    }
    test2() {
        console.log(this.num);
    }
}

(new Test()).test1();