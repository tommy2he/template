class Animal:
    def speak(self):
        pass

class Dog(Animal):
    def speak(self):
        return "Woof!旺旺旺"
    
class Cat(Animal):
    def speak(self):
        return "Meow!喵嗷"
    

def make_noise(animal: Animal):
    return animal.speak()

dog = Dog()
cat = Cat()

# print(make_noise(dog))  
# print(make_noise(cat)) 

an: Animal    # type annotation

an = dog 
print(an.speak())

an = cat 
print(an.speak())


# print(dog.speak())
# print(cat.speak())  

