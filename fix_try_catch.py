import re

with open('src/components/client/BookingStep3DateTime.tsx', 'r') as f:
    content = f.read()

bad_ending = """          }
          setIsLoadingSlots(false);
      }
    };"""

good_ending = """          }
        }
      } catch (error) {
        console.error('Error fetching availability:', error);
      } finally {
        if (isMounted) setIsLoadingSlots(false);
      }
    };"""

content = content.replace(bad_ending, good_ending)

with open('src/components/client/BookingStep3DateTime.tsx', 'w') as f:
    f.write(content)

