import { Pressable, Text } from 'react-native';
import { styled } from 'nativewind';

const StyledPressable = styled(Pressable);
const StyledText = styled(Text);

export function Button({ onPress, title }) {
  return (
    <StyledPressable
      onPress={onPress}
      className="bg-blue-500 px-4 py-2 rounded-lg active:bg-blue-600"
    >
      <StyledText className="text-white font-semibold text-center">{title}</StyledText>
    </StyledPressable>
  );
} 