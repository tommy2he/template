#include <stdio.h>

int main() 
{
    printf("Hello from VS Code with MSYS2!\n");
    printf("GCC version: 15.2.0\n");
    return 0;
}


int fctoorial(int n)
{
    if(n == 0)
    {
        return 1;
    }
    else
    {
        return n * fctoorial(n-1); 
    }

    return 1;
}


int add(int x,int y)
{
    return x + y;
}

int sub(int x,int y)
{
    return x - y;
}

int mul(int x,int y)
{
    return x * y;
}

int div(int x,int y)
{
    return x / y;
}
